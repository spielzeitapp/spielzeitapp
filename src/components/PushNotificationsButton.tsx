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
  const base = import.meta.env.VITE_PUSH_API_URL?.trim();
  if (base) return base.replace(/\/$/, '');
  return '/api/push/subscribe';
}

type Props = {
  className?: string;
};

/**
 * MVP: Permission, SW-Registrierung, PushSubscription, POST an /api/push/subscribe.
 * Benötigt VITE_VAPID_PUBLIC_KEY und serverseitig SUPABASE_SERVICE_ROLE_KEY.
 */
export const PushNotificationsButton: React.FC<Props> = ({ className }) => {
  const [status, setStatus] = useState<
    'idle' | 'unsupported' | 'checking' | 'prompt' | 'loading' | 'granted' | 'denied' | 'error'
  >('idle');
  const [message, setMessage] = useState<string | null>(null);

  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (!vapidPublic) {
      setStatus('error');
      setMessage('VITE_VAPID_PUBLIC_KEY fehlt (.env).');
      return;
    }
    setStatus('checking');
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub && Notification.permission === 'granted') {
          setStatus('granted');
          setMessage('Benachrichtigungen sind aktiv.');
        } else {
          setStatus('prompt');
        }
      } catch {
        setStatus('prompt');
      }
    })();
  }, [vapidPublic]);

  const onActivate = useCallback(async () => {
    setMessage(null);
    if (!vapidPublic) {
      setStatus('error');
      setMessage('VITE_VAPID_PUBLIC_KEY fehlt.');
      return;
    }

    setStatus('loading');

    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus('denied');
        setMessage(
          perm === 'denied'
            ? 'Benachrichtigungen wurden abgelehnt. In den Browser-Einstellungen kannst du sie später erlauben.'
            : 'Berechtigung nicht erteilt.',
        );
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
        applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Ungültige Push-Subscription');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus('error');
        setMessage('Nicht angemeldet.');
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

      setStatus('granted');
      setMessage('Benachrichtigungen sind aktiv.');
    } catch (e: unknown) {
      console.error('[PushNotificationsButton]', e);
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Aktivierung fehlgeschlagen.');
    }
  }, [vapidPublic]);

  if (status === 'unsupported') {
    return (
      <p className={`text-xs text-[var(--text-sub)] ${className ?? ''}`}>
        Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
      </p>
    );
  }

  if (status === 'checking') {
    return (
      <p className={`text-xs text-[var(--text-sub)] ${className ?? ''}`}>Prüfe Benachrichtigungen…</p>
    );
  }

  return (
    <div className={className}>
      <Button type="button" variant="soft" fullWidth onClick={onActivate} disabled={status === 'loading'}>
        {status === 'loading' ? 'Wird eingerichtet…' : 'Benachrichtigungen aktivieren'}
      </Button>
      {message && (
        <p
          className={`mt-2 text-xs ${
            status === 'error' || status === 'denied' ? 'text-amber-300' : 'text-[var(--text-sub)]'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};
