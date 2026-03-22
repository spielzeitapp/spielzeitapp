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

/** POST-Endpoints (gleiche Origin). */
const PUSH_SUBSCRIBE_API = '/api/push/subscribe';
const PUSH_UNSUBSCRIBE_API = '/api/push/unsubscribe';

function permissionToLabel(perm: NotificationPermission): 'default' | 'granted' | 'denied' {
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

/** Nur Browser/Push-Pipeline; API-Fehler werden separat in apiSaveDebug geführt. */
type ActivationState = 'idle' | 'loading' | 'denied' | 'browser_error';

type ApiSaveDebug = {
  result: 'ok' | 'failed';
  statusCode: number;
  bodyText: string;
  /** Kurztext aus JSON.error oder Rohtext */
  errorMessage?: string;
  /** Backend JSON (pushSubscribeHandler) */
  backendStep?: string;
  backendError?: string;
  backendDetails?: string;
  /** Volle/vollständige OK-JSON-Antwort vom Backend (Debug) */
  backendResponseOkJson?: string;
  /** Aus Backend-JSON `ok` */
  apiResult?: 'ok' | 'error' | '—';
  /** Letzte API-Aktion (Debug) */
  operation?: 'subscribe' | 'unsubscribe';
};

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
  const [apiSaveDebug, setApiSaveDebug] = useState<ApiSaveDebug | null>(null);

  const [permissionLabel, setPermissionLabel] = useState<'default' | 'granted' | 'denied'>('default');
  const [subscriptionLabel, setSubscriptionLabel] = useState<'aktiv' | 'nicht aktiv'>('nicht aktiv');

  const [locationInfo, setLocationInfo] = useState<{ host: string; origin: string }>({
    host: '',
    origin: '',
  });

  /** Nach erfolgreichem Deaktivieren + Server-Löschen */
  const [pushDeactivated, setPushDeactivated] = useState(false);

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
    setApiSaveDebug(null);

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

      const webPushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await refreshDebug();

      const json = webPushSubscription.toJSON();
      console.log('[push] subscription after subscribe()', webPushSubscription);
      console.log('[push] subscription.toJSON()', json);

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setActivation('browser_error');
        return;
      }

      const subscription = {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      };

      console.log('Calling push subscribe API', subscription);

      try {
        const res = await fetch(PUSH_SUBSCRIBE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });

        console.log('API response status:', res.status);

        const data = (await res.json()) as {
          ok?: boolean;
          step?: string;
          error?: string;
          details?: string;
          [key: string]: unknown;
        };

        console.log('API response body:', data);

        const backendStep = typeof data.step === 'string' ? data.step : undefined;
        const backendError = typeof data.error === 'string' ? data.error : undefined;
        const backendDetails = typeof data.details === 'string' ? data.details : undefined;
        const apiResult: 'ok' | 'error' | '—' =
          data.ok === true ? 'ok' : data.ok === false ? 'error' : '—';

        const bodyText = JSON.stringify(data);

        if (!res.ok || data.ok === false) {
          setApiSaveDebug({
            result: 'failed',
            statusCode: res.status,
            bodyText: bodyText.slice(0, 2000),
            errorMessage: backendError ?? `HTTP ${res.status}`,
            backendStep,
            backendError: backendError ?? undefined,
            backendDetails,
            apiResult: apiResult === '—' ? 'error' : apiResult,
            operation: 'subscribe',
          });
        } else {
          setApiSaveDebug({
            result: 'ok',
            statusCode: res.status,
            bodyText: bodyText.slice(0, 800),
            backendStep,
            backendError: undefined,
            backendDetails: undefined,
            backendResponseOkJson: bodyText.slice(0, 1200),
            apiResult: 'ok',
          });
        }
        setActivation('idle');
        await refreshDebug();
      } catch (err) {
        console.error('Push save failed:', err);
        setApiSaveDebug({
          result: 'failed',
          statusCode: 0,
          bodyText: err instanceof Error ? err.message : String(err),
          errorMessage: err instanceof Error ? err.message : String(err),
          apiResult: 'error',
        });
        setActivation('idle');
        await refreshDebug();
      }
    } catch (e) {
      console.error('[push] activation catch', e);
      setActivation('browser_error');
      try {
        await refreshDebug();
      } catch {
        /* ignore */
      }
    }
  }, [hasVapidKey, refreshDebug, vapidKey]);

  const onDisablePush = useCallback(async () => {
    setActivation('loading');
    setApiSaveDebug(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setPushDeactivated(true);
        setApiSaveDebug({
          result: 'ok',
          statusCode: 200,
          bodyText: 'no local subscription',
          apiResult: 'ok',
          operation: 'unsubscribe',
          backendStep: 'skipped',
        });
        setActivation('idle');
        await refreshDebug();
        return;
      }

      const endpoint = subscription.endpoint;

      await subscription.unsubscribe();

      const res = await fetch(PUSH_UNSUBSCRIBE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; step?: string };
      const bodyText = JSON.stringify(data);

      if (!res.ok || data.ok === false) {
        setPushDeactivated(false);
        setApiSaveDebug({
          result: 'failed',
          statusCode: res.status,
          bodyText: bodyText.slice(0, 2000),
          errorMessage: data.error ?? `HTTP ${res.status}`,
          backendStep: data.step,
          backendError: data.error,
          apiResult: 'error',
          operation: 'unsubscribe',
        });
      } else {
        setPushDeactivated(true);
        setApiSaveDebug({
          result: 'ok',
          statusCode: res.status,
          bodyText: bodyText.slice(0, 800),
          backendStep: data.ok ? 'saved' : undefined,
          apiResult: 'ok',
          operation: 'unsubscribe',
          backendResponseOkJson: bodyText.slice(0, 1200),
        });
      }

      setActivation('idle');
      await refreshDebug();
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      setPushDeactivated(false);
      setApiSaveDebug({
        result: 'failed',
        statusCode: 0,
        bodyText: err instanceof Error ? err.message : String(err),
        errorMessage: err instanceof Error ? err.message : String(err),
        apiResult: 'error',
        operation: 'unsubscribe',
      });
      setActivation('idle');
      await refreshDebug();
    }
  }, [refreshDebug]);

  const loading = !initDone || activation === 'loading';
  const disabled = !hasVapidKey || loading;
  const disabledDeactivate = loading;

  const message = useMemo(() => {
    if (!hasVapidKey) {
      return 'Push Setup fehlt – bitte Vercel ENV setzen';
    }
    if (activation === 'denied') {
      return 'Benachrichtigungen wurden abgelehnt';
    }
    if (activation === 'browser_error') {
      return 'Aktivierung fehlgeschlagen (Browser/Push-Pipeline)';
    }
    if (pushDeactivated && subscriptionLabel === 'nicht aktiv') {
      return 'Push deaktiviert';
    }
    // Browser-Push ok: Meldung von API/Subscription abhängig, nicht von generischem "error"
    if (subscriptionLabel === 'aktiv' && apiSaveDebug?.result === 'ok') {
      return 'Push aktiviert ✅';
    }
    if (subscriptionLabel === 'aktiv' && apiSaveDebug?.result === 'failed') {
      return 'Push im Browser aktiv, aber Speichern am Server fehlgeschlagen';
    }
    if (subscriptionLabel === 'aktiv') {
      return 'Push aktiv (Browser)';
    }
    return 'Push verfügbar';
  }, [hasVapidKey, activation, subscriptionLabel, apiSaveDebug, pushDeactivated]);

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
          !hasVapidKey ||
          activation === 'denied' ||
          activation === 'browser_error' ||
          (subscriptionLabel === 'aktiv' && apiSaveDebug?.result === 'failed')
            ? 'text-amber-300'
            : 'text-[var(--text-main)]'
        }`}
      >
        {message}
      </p>
      {subscriptionLabel === 'aktiv' && apiSaveDebug?.result === 'failed' && (apiSaveDebug.backendError || apiSaveDebug.errorMessage) ? (
        <p className="mt-1 text-xs text-amber-200/90">
          {apiSaveDebug.backendStep ? `[${apiSaveDebug.backendStep}] ` : ''}
          {apiSaveDebug.backendError ?? apiSaveDebug.errorMessage}
        </p>
      ) : null}

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
        <div>Last API op: {apiSaveDebug?.operation ?? '—'}</div>
        <div className="mt-2 border-t border-amber-500/30 pt-2">
          API save result: {apiSaveDebug ? (apiSaveDebug.result === 'ok' ? 'ok' : 'failed') : '—'}
        </div>
        <div>API status code: {apiSaveDebug?.statusCode ?? '—'}</div>
        <div>API result (ok / error): {apiSaveDebug?.apiResult ?? '—'}</div>
        <div className="break-all">
          API error / body:{' '}
          {apiSaveDebug && apiSaveDebug.result === 'failed'
            ? apiSaveDebug.errorMessage ?? apiSaveDebug.bodyText.slice(0, 200)
            : apiSaveDebug?.result === 'ok'
              ? apiSaveDebug.bodyText.slice(0, 120) || 'ok'
              : '—'}
        </div>
        <div>backend step: {apiSaveDebug?.backendStep ?? '—'}</div>
        <div className="break-all">backend error: {apiSaveDebug?.backendError ?? apiSaveDebug?.errorMessage ?? '—'}</div>
        {apiSaveDebug?.backendDetails ? (
          <div className="break-all text-[9px] opacity-90">backend details: {apiSaveDebug.backendDetails.slice(0, 400)}</div>
        ) : null}
        {apiSaveDebug?.result === 'ok' && apiSaveDebug.backendResponseOkJson ? (
          <div className="mt-1 break-all text-[9px] text-emerald-200/90">
            backend response (ok): {apiSaveDebug.backendResponseOkJson}
          </div>
        ) : null}
      </div>
    </div>
  );
};
