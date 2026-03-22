'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getSubscribeApiUrl(): string {
  const base = process.env.NEXT_PUBLIC_PUSH_API_URL?.trim();
  if (base) return base.replace(/\/$/, '');
  return '/api/push/subscribe';
}

/** Anzeige: default | granted | denied */
function permissionToLabel(perm: NotificationPermission): 'default' | 'granted' | 'denied' {
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

type ActivationState = 'idle' | 'loading' | 'success' | 'error' | 'denied';

type Props = {
  className?: string;
};

/**
 * Web Push: NEXT_PUBLIC_VAPID_PUBLIC_KEY → Permission → /sw.js → subscribe → POST /api/push/subscribe
 * Server (Vercel): VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY
 */
export const PushNotificationsButton: React.FC<Props> = ({ className }) => {
  const vapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();
  const hasVapidKey = vapidKey.length > 0;

  const [browserOk, setBrowserOk] = useState(true);
  const [initDone, setInitDone] = useState(false);

  const [activation, setActivation] = useState<ActivationState>('idle');

  const [permissionLabel, setPermissionLabel] = useState<'default' | 'granted' | 'denied'>('default');
  const [subscriptionLabel, setSubscriptionLabel] = useState<'aktiv' | 'nicht aktiv'>('nicht aktiv');

  const refreshDebug = useCallback(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    try {
      setPermissionLabel(permissionToLabel(Notification.permission));
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscriptionLabel(sub ? 'aktiv' : 'nicht aktiv');
    } catch {
      setSubscriptionLabel('nicht aktiv');
    }
  }, []);

  const isPushActive =
    subscriptionLabel === 'aktiv' && permissionLabel === 'granted';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setBrowserOk(false);
      setInitDone(true);
      return;
    }

    void (async () => {
      try {
        if (!hasVapidKey) {
          setPermissionLabel(permissionToLabel(Notification.permission));
          setSubscriptionLabel('nicht aktiv');
          return;
        }

        await refreshDebug();

        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub && Notification.permission === 'granted') {
          setActivation('success');
        }
      } catch {
        setActivation('idle');
      } finally {
        setInitDone(true);
      }
    })();
  }, [hasVapidKey, refreshDebug]);

  const onActivate = useCallback(async () => {
    if (!hasVapidKey) return;

    setActivation('loading');

    try {
      const perm = await Notification.requestPermission();
      await refreshDebug();

      if (perm !== 'granted') {
        setActivation('denied');
        await refreshDebug();
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await refreshDebug();

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setActivation('error');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setActivation('error');
        return;
      }

      const apiUrl = getSubscribeApiUrl();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        }),
      });

      await res.json().catch(() => ({}));
      if (!res.ok) {
        setActivation('error');
        return;
      }

      setActivation('success');
      await refreshDebug();
    } catch {
      setActivation('error');
      try {
        await refreshDebug();
      } catch {
        /* ignore */
      }
    }
  }, [hasVapidKey, refreshDebug, vapidKey]);

  if (!browserOk) {
    return (
      <p className={`text-xs text-[var(--text-sub)] ${className ?? ''}`}>
        Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
      </p>
    );
  }

  const loading = !initDone || activation === 'loading';
  const disabled = loading || !hasVapidKey || isPushActive || activation === 'success';

  const buttonLabel =
    !initDone ? 'Lade…' : activation === 'loading' ? 'Aktiviere…' : 'Benachrichtigungen aktivieren';

  let statusText: string;
  if (!hasVapidKey) {
    statusText = 'Push Setup fehlt – bitte Vercel ENV setzen';
  } else if (activation === 'error' || activation === 'denied') {
    statusText = 'Aktivierung fehlgeschlagen';
  } else if (isPushActive || activation === 'success') {
    statusText = 'Push aktiviert ✅';
  } else {
    statusText = 'Push verfügbar';
  }

  return (
    <div className={className}>
      <Button type="button" variant="soft" fullWidth onClick={onActivate} disabled={disabled}>
        {buttonLabel}
      </Button>

      <p
        className={`mt-2 text-sm ${
          !hasVapidKey || activation === 'error' || activation === 'denied'
            ? 'text-amber-300'
            : 'text-[var(--text-main)]'
        }`}
      >
        {statusText}
      </p>

      <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-snug text-[var(--text-sub)]">
        <div>
          <span className="text-white/50">Berechtigung:</span>{' '}
          <span className="font-medium text-[var(--text-main)]">{permissionLabel}</span>
        </div>
        <div>
          <span className="text-white/50">Subscription:</span>{' '}
          <span className="font-medium text-[var(--text-main)]">{subscriptionLabel}</span>
        </div>
      </div>
    </div>
  );
};
