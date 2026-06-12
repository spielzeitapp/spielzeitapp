'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../app/components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { usePushSubscription } from '../hooks/usePushSubscription';
import {
  PUSH_TEST_API,
  textLooksLikeVapidMismatch,
} from '../lib/pushSubscriptionCore';

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
  /** Nur wenn Backend admin UND echte Admin-UI (kein Preview): Debug + Test-Push */
  isAdminToolsVisible?: boolean;
};

export const PushNotificationsButton: React.FC<Props> = ({
  className,
  isAdminToolsVisible = false,
}) => {
  const { user: authUser } = useAuth();
  const {
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
    activate,
    deactivate,
  } = usePushSubscription(authUser?.id);

  const [testPushMessage, setTestPushMessage] = useState<string | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);

  const [debugSnapshot, setDebugSnapshot] = useState<{
    lastApiStatus?: number;
    lastBody?: string;
    lastStep?: string;
    lastSent?: number;
    lastFailed?: number;
  }>({});

  useEffect(() => {
    if (!initDone || hasVapidKey) return;
    console.warn(
      '[SpielzeitApp] Push: VAPID public key fehlt. In Vercel setzen: VITE_VAPID_PUBLIC_KEY (und serverseitig VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY).',
    );
  }, [initDone, hasVapidKey]);

  const onActivate = useCallback(async () => {
    setTestPushMessage(null);
    await activate();
  }, [activate]);

  const onDeactivate = useCallback(async () => {
    setTestPushMessage(null);
    await deactivate();
  }, [deactivate]);

  const onTestPush = useCallback(async () => {
    if (!isAdminToolsVisible) return;
    setTestPushLoading(true);
    setTestPushMessage(null);
    try {
      const res = await fetch(PUSH_TEST_API, { method: 'POST' });
      const data = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        results?: Array<{ success?: boolean; error?: string | null }>;
      };
      const rawJson = JSON.stringify(data).slice(0, 1500);
      setDebugSnapshot((prev) => ({
        ...prev,
        lastApiStatus: res.status,
        lastSent: typeof data.sent === 'number' ? data.sent : undefined,
        lastFailed: typeof data.failed === 'number' ? data.failed : undefined,
        lastBody: rawJson,
        lastStep: 'test-broadcast',
      }));
      if (res.ok && data.ok === true) {
        const mismatch =
          Array.isArray(data.results) &&
          data.results.some((r) => r && textLooksLikeVapidMismatch(String(r.error ?? '')));
        if (mismatch) {
          setTestPushMessage(
            'Test Push: VAPID-Mismatch erkannt – VITE_VAPID_PUBLIC_KEY und VAPID_PUBLIC_KEY in Vercel angleichen, Push neu aktivieren.',
          );
        } else {
          setTestPushMessage('Test Push gesendet');
        }
      } else {
        setTestPushMessage('Test Push fehlgeschlagen');
      }
    } catch {
      setTestPushMessage('Test Push fehlgeschlagen');
    } finally {
      setTestPushLoading(false);
    }
  }, [isAdminToolsVisible]);

  const busy = loading || !initDone;

  const primaryButtonLabel = useMemo(() => {
    if (loadingAction === 'activate') return 'Wird aktiviert…';
    if (loadingAction === 'deactivate') return 'Wird deaktiviert…';
    return isActive ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren';
  }, [loadingAction, isActive]);

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
          Push-Benachrichtigungen sind auf diesem Server noch nicht konfiguriert.
        </p>
      )}

      {hasVapidKey && (
        <>
          {isActive ? (
            <>
              <p className="mt-3 text-sm text-[var(--text-main)]">Push aktiv ✅</p>
              <p className="mt-1 text-sm text-[var(--text-sub)]">
                Du erhältst Updates zu Spielen & Terminen.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-main)]">
              Benachrichtigungen sind derzeit deaktiviert.
            </p>
          )}

          {actionError && (
            <div className="mt-2 space-y-1" role="alert">
              <p className="text-sm text-amber-300">{actionError}</p>
              {textLooksLikeVapidMismatch(actionError) && (
                <p className="text-xs text-amber-200/90">
                  VAPID-Schlüssel passen nicht zusammen: In Vercel müssen{' '}
                  <code className="rounded bg-black/40 px-1">VITE_VAPID_PUBLIC_KEY</code> und{' '}
                  <code className="rounded bg-black/40 px-1">VAPID_PUBLIC_KEY</code> exakt gleich sein.
                  Danach Push hier deaktivieren und erneut aktivieren.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={busy || (!pushReady && !isActive)}
              onClick={() => void (isActive ? onDeactivate() : onActivate())}
              className={
                isActive
                  ? '!border-2 !border-red-500/65 !bg-red-950/40 !text-red-100 hover:!bg-red-900/50 focus-visible:!shadow-[0_0_0_2px_rgba(239,68,68,0.35)]'
                  : '!border-0 !bg-gradient-to-br !from-emerald-600 !to-green-800 !text-white hover:!from-emerald-500 hover:!to-green-700 focus-visible:!shadow-[0_0_0_2px_rgba(16,185,129,0.45)]'
              }
            >
              {primaryButtonLabel}
            </Button>

            {isAdminToolsVisible && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={testPushLoading}
                  onClick={() => void onTestPush()}
                  className="!border-white/20 !bg-zinc-800/60 !text-zinc-200 hover:!bg-zinc-700/70"
                >
                  {testPushLoading ? 'Wird gesendet…' : 'Test Push senden'}
                </Button>
                {testPushMessage && (
                  <p className="text-center text-sm text-[var(--text-sub)]">{testPushMessage}</p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {isAdminToolsVisible && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/90">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
            Push-Debug (Admin)
          </div>
          <div>runtime: {detectFrontendRuntime()}</div>
          <div>VAPID configured: {hasVapidKey ? 'yes' : 'no'}</div>
          <div>permission: {permission}</div>
          <div>subscriptionActive: {subscriptionActive ? 'yes' : 'no'}</div>
          <div>last API status: {debugSnapshot.lastApiStatus ?? '—'}</div>
          <div>
            sent / failed: {debugSnapshot.lastSent ?? '—'} / {debugSnapshot.lastFailed ?? '—'}
          </div>
          <div>last step: {debugSnapshot.lastStep ?? '—'}</div>
          <div className="break-all opacity-90">last body: {debugSnapshot.lastBody ?? '—'}</div>
        </div>
      )}
    </div>
  );
};
