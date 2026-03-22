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

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await refreshDebug();

      const json = subscription.toJSON();
      console.log('[push] subscription after subscribe()', subscription);
      console.log('[push] subscription.toJSON()', json);

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setActivation('browser_error');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const msg = 'Kein Auth-Token – bitte erneut anmelden.';
        setApiSaveDebug({
          result: 'failed',
          statusCode: 0,
          bodyText: msg,
          errorMessage: msg,
        });
        setActivation('idle');
        await refreshDebug();
        return;
      }

      const fetchUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${PUSH_SUBSCRIBE_API}` : PUSH_SUBSCRIBE_API;
      const requestBody = {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      };

      console.log('[push] POST save subscription', { fetchUrl, body: requestBody });

      const res = await fetch(PUSH_SUBSCRIBE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseBodyText = await res.text();
      console.log('[push] API response', { status: res.status, ok: res.ok, body: responseBodyText });

      let parsedBackend: {
        ok?: boolean;
        step?: string;
        error?: string;
        details?: string;
      } | null = null;
      try {
        parsedBackend = JSON.parse(responseBodyText) as typeof parsedBackend;
      } catch {
        parsedBackend = null;
      }

      const backendStep = typeof parsedBackend?.step === 'string' ? parsedBackend.step : undefined;
      const backendError = typeof parsedBackend?.error === 'string' ? parsedBackend.error : undefined;
      const backendDetails = typeof parsedBackend?.details === 'string' ? parsedBackend.details : undefined;
      const parsedErr = backendError;

      if (!res.ok) {
        setApiSaveDebug({
          result: 'failed',
          statusCode: res.status,
          bodyText: responseBodyText.slice(0, 2000),
          errorMessage: parsedErr ?? (responseBodyText.slice(0, 500) || `HTTP ${res.status}`),
          backendStep,
          backendError: backendError ?? parsedErr,
          backendDetails,
        });
        setActivation('idle');
        await refreshDebug();
        return;
      }

      setApiSaveDebug({
        result: 'ok',
        statusCode: res.status,
        bodyText: responseBodyText.slice(0, 500),
        backendStep: backendStep ?? (res.ok ? 'ok' : undefined),
        backendError: undefined,
        backendDetails: undefined,
        backendResponseOkJson: responseBodyText.slice(0, 1200),
      });
      setActivation('idle');
      await refreshDebug();
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

  const loading = !initDone || activation === 'loading';
  const disabled = !hasVapidKey || loading;

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
  }, [hasVapidKey, activation, subscriptionLabel, apiSaveDebug]);

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
        <div className="mt-2 border-t border-amber-500/30 pt-2">
          API save result: {apiSaveDebug ? (apiSaveDebug.result === 'ok' ? 'ok' : 'failed') : '—'}
        </div>
        <div>API status code: {apiSaveDebug?.statusCode ?? '—'}</div>
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
