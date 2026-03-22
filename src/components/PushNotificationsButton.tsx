'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const PUSH_SUBSCRIBE_API = '/api/push/subscribe';
const PUSH_UNSUBSCRIBE_API = '/api/push/unsubscribe';

function getVapidPublicKey(): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY != null
      ? String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).trim()
      : '';
  if (fromProcess.length > 0) return fromProcess;
  const fromVite =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY != null
      ? String(import.meta.env.VITE_VAPID_PUBLIC_KEY).trim()
      : '';
  return fromVite;
}

function detectFrontendRuntime(): 'vite' | 'next' | 'unknown' {
  if (typeof import.meta !== 'undefined' && import.meta.env && 'MODE' in import.meta.env) {
    return 'vite';
  }
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_RUNTIME != null) {
    return 'next';
  }
  return 'unknown';
}

type Props = {
  className?: string;
  /** Nur für Admins: technisches Debug-Panel */
  showDebug?: boolean;
};

export const PushNotificationsButton: React.FC<Props> = ({ className, showDebug = false }) => {
  const rawVapidKey = getVapidPublicKey();
  const vapidKey = rawVapidKey?.trim() ?? '';
  const hasVapidKey = vapidKey.length > 0;

  const [browserOk, setBrowserOk] = useState(true);
  const [initDone, setInitDone] = useState(false);

  /** Notification.permission */
  const [permission, setPermission] = useState<NotificationPermission>('default');
  /** PushSubscription vorhanden */
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  /** 'activate' | 'deactivate' während Request */
  const [loadingAction, setLoadingAction] = useState<'activate' | 'deactivate' | null>(null);
  /** Erfolgshinweise */
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  /** Nutzerfreundliche Fehlermeldung (Anzeige C) */
  const [actionError, setActionError] = useState<string | null>(null);

  /** Admin-Debug */
  const [debugSnapshot, setDebugSnapshot] = useState<{
    lastApiStatus?: number;
    lastBody?: string;
    lastStep?: string;
  }>({});

  const syncFromBrowser = useCallback(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscriptionActive(Boolean(sub));
    } catch {
      setSubscriptionActive(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setBrowserOk(false);
      setInitDone(true);
      return;
    }
    void (async () => {
      try {
        await syncFromBrowser();
      } finally {
        setInitDone(true);
      }
    })();
  }, [syncFromBrowser]);

  const pushReady = browserOk && hasVapidKey && initDone;

  const isActive = useMemo(() => {
    return subscriptionActive && permission === 'granted';
  }, [subscriptionActive, permission]);

  const onActivate = useCallback(async () => {
    if (!hasVapidKey || !browserOk) return;
    setLoading(true);
    setLoadingAction('activate');
    setActionError(null);
    setActionMessage(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      const webPushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = webPushSubscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return;
      }

      const payload = {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      };

      const res = await fetch(PUSH_SUBSCRIBE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; step?: string; error?: string };
      if (showDebug) {
        setDebugSnapshot({
          lastApiStatus: res.status,
          lastBody: JSON.stringify(data).slice(0, 1500),
          lastStep: typeof data.step === 'string' ? data.step : undefined,
        });
      }

      if (!res.ok || data.ok === false) {
        setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return;
      }

      await syncFromBrowser();
    } catch {
      setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }, [browserOk, hasVapidKey, vapidKey, syncFromBrowser, showDebug]);

  const onDeactivate = useCallback(async () => {
    setLoading(true);
    setLoadingAction('deactivate');
    setActionError(null);
    setActionMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        await syncFromBrowser();
        setActionMessage('Benachrichtigungen deaktiviert');
        return;
      }

      const endpoint = subscription.endpoint;

      const res = await fetch(PUSH_UNSUBSCRIBE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      const data = (await res.json()) as { ok?: boolean; step?: string; error?: string };
      if (showDebug) {
        setDebugSnapshot({
          lastApiStatus: res.status,
          lastBody: JSON.stringify(data).slice(0, 1500),
          lastStep: typeof data.step === 'string' ? data.step : undefined,
        });
      }

      if (!res.ok || data.ok === false) {
        setActionError('Deaktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return;
      }

      await subscription.unsubscribe();

      setActionMessage('Benachrichtigungen deaktiviert');
      await syncFromBrowser();
    } catch {
      setActionError('Deaktivierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }, [syncFromBrowser, showDebug]);

  const statusText = useMemo(() => {
    if (actionMessage === 'Benachrichtigungen deaktiviert') return 'Benachrichtigungen deaktiviert';
    if (isActive) return 'Push aktiv ✅';
    return 'Benachrichtigungen sind derzeit deaktiviert.';
  }, [actionMessage, isActive]);

  const busy = loading || !initDone;

  if (!browserOk) {
    return (
      <div className={className}>
        <h2 className="text-base font-semibold text-[var(--text-main)]">Benachrichtigungen</h2>
        <p className="mt-1 text-sm text-[var(--text-sub)]">
          Erhalte Updates zu Spielen, Terminen und wichtigen Änderungen.
        </p>
        <p className="mt-2 text-sm text-[var(--text-sub)]">
          In diesem Browser werden Push-Benachrichtigungen nicht unterstützt.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="text-base font-semibold text-[var(--text-main)]">Benachrichtigungen</h2>
      <p className="mt-1 text-sm text-[var(--text-sub)]">
        Erhalte Updates zu Spielen, Terminen und wichtigen Änderungen.
      </p>

      {!hasVapidKey && (
        <p className="mt-3 text-sm text-amber-200/90">
          Diese Funktion ist aktuell nicht verfügbar.
        </p>
      )}

      {hasVapidKey && (
        <>
          <p className="mt-3 text-sm text-[var(--text-main)]">{statusText}</p>

          {actionError && (
            <p className="mt-2 text-sm text-amber-300" role="alert">
              {actionError}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {!isActive ? (
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={busy || !pushReady}
                onClick={() => void onActivate()}
              >
                {loadingAction === 'activate' ? 'Wird aktiviert…' : 'Benachrichtigungen aktivieren'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={() => void onDeactivate()}
              >
                {loadingAction === 'deactivate' ? 'Wird deaktiviert…' : 'Benachrichtigungen deaktivieren'}
              </Button>
            )}
          </div>
        </>
      )}

      {showDebug && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/90">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
            Push-Debug (Admin)
          </div>
          <div>runtime: {detectFrontendRuntime()}</div>
          <div>VAPID configured: {hasVapidKey ? 'yes' : 'no'}</div>
          <div>permission: {permission}</div>
          <div>subscriptionActive: {subscriptionActive ? 'yes' : 'no'}</div>
          <div>last API status: {debugSnapshot.lastApiStatus ?? '—'}</div>
          <div>last step: {debugSnapshot.lastStep ?? '—'}</div>
          <div className="break-all opacity-90">last body: {debugSnapshot.lastBody ?? '—'}</div>
        </div>
      )}
    </div>
  );
};
