'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

/** POST-Endpoint für gespeicherte Push-Subscription (gleiche Origin). */
const PUSH_SUBSCRIBE_API = '/api/push/subscribe';

function permissionToLabel(perm: NotificationPermission): 'default' | 'granted' | 'denied' {
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

type ActivationState = 'idle' | 'loading' | 'error' | 'denied';

type Props = {
  className?: string;
};

/**
 * Web Push: VAPID public key → Permission → /sw.js → subscribe → POST /api/push/subscribe
 * Vite-Build: Key kommt aus vite.config define (NEXT_PUBLIC_* oder VITE_* zur Build-Zeit).
 * Server (Vercel): VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY
 */
function getVapidPublicKey(): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY != null
      ? String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).trim()
      : '';
  if (fromProcess.length > 0) return fromProcess;
  const fromVite = typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY != null
    ? String(import.meta.env.VITE_VAPID_PUBLIC_KEY).trim()
    : '';
  return fromVite;
}

/** Laufzeit: Vite (kein Next.js in diesem Repo). */
function detectFrontendRuntime(): 'vite' | 'next' | 'unknown' {
  if (typeof import.meta !== 'undefined' && import.meta.env && 'MODE' in import.meta.env) {
    return 'vite';
  }
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_RUNTIME != null) {
    return 'next';
  }
  return 'unknown';
}

export const PushNotificationsButton: React.FC<Props> = ({ className }) => {
  const rawVapidKey = getVapidPublicKey();
  const vapidKey = rawVapidKey?.trim() || '';
  const hasVapidKey = vapidKey.length > 0;

  const frontendRuntime = detectFrontendRuntime();
  const envSourceLabel =
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY === 'string' &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim().length > 0
      ? 'process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY (Vite define)'
      : typeof import.meta !== 'undefined' &&
          import.meta.env?.VITE_VAPID_PUBLIC_KEY != null &&
          String(import.meta.env.VITE_VAPID_PUBLIC_KEY).length > 0
        ? 'import.meta.env.VITE_VAPID_PUBLIC_KEY'
        : 'none (key missing at build time)';

  const [browserOk, setBrowserOk] = useState(true);
  const [initDone, setInitDone] = useState(false);
  const [activation, setActivation] = useState<ActivationState>('idle');

  const [permissionLabel, setPermissionLabel] = useState<'default' | 'granted' | 'denied'>('default');
  const [subscriptionLabel, setSubscriptionLabel] = useState<'aktiv' | 'nicht aktiv'>('nicht aktiv');

  const [locationInfo, setLocationInfo] = useState<{ host: string; origin: string }>({
    host: '',
    origin: '',
  });

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

    setLocationInfo({
      host: window.location.host,
      origin: window.location.origin,
    });

    console.log('PUSH DEBUG', {
      rawVapidKey,
      vapidKey,
      hasVapidKey,
      host: typeof window !== 'undefined' ? window.location.host : null,
      origin: typeof window !== 'undefined' ? window.location.origin : null,
    });

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setBrowserOk(false);
      setInitDone(true);
      return;
    }

    void (async () => {
      try {
        await refreshDebug();
      } catch {
        /* ignore */
      } finally {
        setInitDone(true);
      }
    })();
  }, [rawVapidKey, vapidKey, hasVapidKey, refreshDebug]);

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

      const res = await fetch(PUSH_SUBSCRIBE_API, {
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

      setActivation('idle');
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

  const loading = !initDone || activation === 'loading';
  const disabled = !hasVapidKey || loading;

  const message = useMemo(() => {
    if (!hasVapidKey) {
      return 'Push Setup fehlt – bitte Vercel ENV setzen';
    }
    if (activation === 'error' || activation === 'denied') {
      return 'Aktivierung fehlgeschlagen';
    }
    if (subscriptionLabel === 'aktiv') {
      return 'Push aktiviert ✅';
    }
    return 'Push verfügbar';
  }, [hasVapidKey, activation, subscriptionLabel]);

  const keyPreview = hasVapidKey ? vapidKey.slice(0, 12) : '—';

  if (!browserOk) {
    return (
      <p className={`text-xs text-[var(--text-sub)] ${className ?? ''}`}>
        Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
      </p>
    );
  }

  const buttonLabel = !initDone ? 'Lade…' : activation === 'loading' ? 'Aktiviere…' : 'Benachrichtigungen aktivieren';

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
        {message}
      </p>

      {/* TEMP: Debug-Panel entfernen, sobald ENV/Build geklärt ist */}
      <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/90">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
          Push ENV (temporär)
        </div>
        <div>frontend type detected: {frontendRuntime}</div>
        <div>env source used: {envSourceLabel}</div>
        <div>
          build target: MODE={typeof import.meta !== 'undefined' ? import.meta.env?.MODE : '—'} | PROD=
          {typeof import.meta !== 'undefined' ? String(import.meta.env?.PROD) : '—'} | BASE_URL=
          {typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : '—'}
        </div>
        <div>ENV key present: {hasVapidKey ? 'yes' : 'no'}</div>
        <div>ENV key length: {vapidKey.length}</div>
        <div>ENV key preview: {keyPreview}</div>
        <div>Host: {locationInfo.host || '—'}</div>
        <div>Origin: {locationInfo.origin || '—'}</div>
        <div>Permission: {permissionLabel}</div>
        <div>Subscription: {subscriptionLabel}</div>
      </div>
    </div>
  );
};
