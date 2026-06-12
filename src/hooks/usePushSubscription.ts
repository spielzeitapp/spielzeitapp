import { useCallback, useEffect, useMemo, useState } from 'react';
import { markPushOnboardingActivated } from '../lib/pushOnboardingPrompt';
import {
  getVapidPublicKey,
  isPushBrowserSupported,
  isPushFullyActive,
  PUSH_SUBSCRIBE_API,
  PUSH_UNSUBSCRIBE_API,
  readPushStateFromBrowser,
  urlBase64ToUint8Array,
} from '../lib/pushSubscriptionCore';

type ActivateResult = { ok: true } | { ok: false; reason: 'denied' | 'error' };

export function usePushSubscription(userId: string | undefined) {
  const vapidKey = getVapidPublicKey();
  const hasVapidKey = vapidKey.length > 0;

  const [browserOk, setBrowserOk] = useState(() => isPushBrowserSupported());
  const [initDone, setInitDone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'activate' | 'deactivate' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const syncFromBrowser = useCallback(async () => {
    const state = await readPushStateFromBrowser();
    setPermission(state.permission);
    setSubscriptionActive(state.subscriptionActive);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPushBrowserSupported()) {
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
  const isActive = useMemo(
    () => isPushFullyActive(permission, subscriptionActive),
    [permission, subscriptionActive],
  );

  const activate = useCallback(async (): Promise<ActivateResult> => {
    if (!hasVapidKey || !browserOk) return { ok: false, reason: 'error' };
    setLoading(true);
    setLoadingAction('activate');
    setActionError(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return { ok: false, reason: 'denied' };
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
        return { ok: false, reason: 'error' };
      }

      const payload: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        user_id?: string;
      } = {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      };
      if (userId) {
        payload.user_id = userId;
      }

      const res = await fetch(PUSH_SUBSCRIBE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; step?: string; error?: string };

      if (!res.ok || data.ok === false) {
        setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return { ok: false, reason: 'error' };
      }

      await syncFromBrowser();
      if (userId) markPushOnboardingActivated(userId);
      return { ok: true };
    } catch {
      setActionError('Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
      return { ok: false, reason: 'error' };
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }, [userId, browserOk, hasVapidKey, vapidKey, syncFromBrowser]);

  const deactivate = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setLoadingAction('deactivate');
    setActionError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        await syncFromBrowser();
        return true;
      }

      const endpoint = subscription.endpoint;

      const res = await fetch(PUSH_UNSUBSCRIBE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      const data = (await res.json()) as { ok?: boolean; step?: string; error?: string };

      if (!res.ok || data.ok === false) {
        setActionError('Deaktivierung fehlgeschlagen. Bitte versuche es erneut.');
        return false;
      }

      await subscription.unsubscribe();
      await syncFromBrowser();
      return true;
    } catch {
      setActionError('Deaktivierung fehlgeschlagen. Bitte versuche es erneut.');
      return false;
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }, [syncFromBrowser]);

  return {
    vapidKey,
    hasVapidKey,
    browserOk,
    initDone,
    permission,
    subscriptionActive,
    isActive,
    pushReady,
    loading,
    loadingAction,
    actionError,
    setActionError,
    syncFromBrowser,
    activate,
    deactivate,
  };
}
