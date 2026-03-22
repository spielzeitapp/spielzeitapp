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

function permissionToLabel(perm: NotificationPermission): string {
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

type Props = {
  className?: string;
};

/**
 * Web Push: Permission → Service Worker → PushManager.subscribe → POST /api/push/subscribe
 * Benötigt NEXT_PUBLIC_VAPID_PUBLIC_KEY (Client) und serverseitig SUPABASE_SERVICE_ROLE_KEY.
 */
export const PushNotificationsButton: React.FC<Props> = ({ className }) => {
  const [browserOk, setBrowserOk] = useState(true);
  const [initDone, setInitDone] = useState(false);
  const [configMissing, setConfigMissing] = useState(false);

  const [activation, setActivation] = useState<'idle' | 'loading' | 'success' | 'error' | 'denied'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const [permissionLabel, setPermissionLabel] = useState<string>('—');
  const [subscriptionLabel, setSubscriptionLabel] = useState<string>('—');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setBrowserOk(false);
      setInitDone(true);
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    console.log('VAPID KEY:', vapidKey);

    void (async () => {
      try {
        if (!vapidKey?.trim()) {
          console.warn('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY');
          setConfigMissing(true);
          setMessage('Push Setup fehlt (ENV nicht gesetzt)');
          setPermissionLabel(permissionToLabel(Notification.permission));
          setSubscriptionLabel('nicht aktiv');
          return;
        }

        await refreshDebug();

        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub && Notification.permission === 'granted') {
          setActivation('success');
          setMessage('Push aktiviert ✅');
        }
      } catch (e) {
        console.error('[PushNotificationsButton] init', e);
        setMessage(null);
      } finally {
        setInitDone(true);
      }
    })();
  }, [refreshDebug]);

  const onActivate = useCallback(async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    console.log('VAPID KEY:', vapidKey);

    if (!vapidKey) {
      setMessage('Push Setup fehlt (ENV nicht gesetzt)');
      return;
    }

    setActivation('loading');
    setMessage(null);

    try {
      const perm = await Notification.requestPermission();
      await refreshDebug();

      if (perm !== 'granted') {
        setActivation('denied');
        setMessage('Push fehlgeschlagen');
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
        throw new Error('Ungültige Push-Subscription');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setActivation('error');
        setMessage('Push fehlgeschlagen');
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

      const payload = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(payload.error || `Server ${res.status}`);
      }

      setActivation('success');
      setMessage('Push aktiviert ✅');
      await refreshDebug();
    } catch (e: unknown) {
      console.error('[PushNotificationsButton]', e);
      setActivation('error');
      setMessage('Push fehlgeschlagen');
      try {
        await refreshDebug();
      } catch {
        /* ignore */
      }
    }
  }, [refreshDebug]);

  if (!browserOk) {
    return (
      <p className={`text-xs text-[var(--text-sub)] ${className ?? ''}`}>
        Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
      </p>
    );
  }

  const loading = !initDone || activation === 'loading';
  const disabled = loading || configMissing || activation === 'success';

  const buttonLabel = !initDone ? 'Lade…' : activation === 'loading' ? 'Aktiviere…' : 'Benachrichtigungen aktivieren';

  return (
    <div className={className}>
      <Button type="button" variant="soft" fullWidth onClick={onActivate} disabled={disabled}>
        {buttonLabel}
      </Button>

      {message && (
        <p
          className={`mt-2 text-sm ${
            activation === 'error' || activation === 'denied' ? 'text-amber-300' : 'text-[var(--text-main)]'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-snug text-[var(--text-sub)]">
        <div>
          <span className="text-white/50">Permission:</span>{' '}
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
