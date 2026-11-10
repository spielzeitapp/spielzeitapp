import React, { useEffect, useRef, useState } from 'react';

type TurnstileWidgetId = string;

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'compact' | 'flexible';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      'timeout-callback': () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = 'spielzeitapp-turnstile-script';
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITE_KEY = String(
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
).trim();

export const isTurnstileConfigured = TURNSTILE_SITE_KEY.length > 0;

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Cloudflare Turnstile konnte nicht geladen werden.'));
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile-Ladefehler')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile-Ladefehler')), {
      once: true,
    });
    document.head.appendChild(script);
  });

  turnstileScriptPromise = turnstileScriptPromise.catch((error) => {
    turnstileScriptPromise = null;
    document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
    throw error;
  });
  return turnstileScriptPromise;
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onTokenChange,
  resetKey = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const callbackRef = useRef(onTokenChange);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  callbackRef.current = onTokenChange;

  useEffect(() => {
    if (!isTurnstileConfigured || !containerRef.current) return;
    let cancelled = false;
    let refreshTimer: number | undefined;
    let expiresAt = 0;
    callbackRef.current(null);
    setLoadError(false);
    const refresh = () => {
      if (cancelled) return;
      callbackRef.current(null);
      setRetryKey((value) => value + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && expiresAt && Date.now() >= expiresAt) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => {
            if (cancelled) return;
            window.clearTimeout(refreshTimer);
            // Refresh before Cloudflare's five-minute single-use token expires.
            expiresAt = Date.now() + 240_000;
            refreshTimer = window.setTimeout(refresh, 240_000);
            setLoadError(false);
            callbackRef.current(token);
          },
          'expired-callback': refresh,
          'timeout-callback': refresh,
          'error-callback': () => {
            if (cancelled) return;
            window.clearTimeout(refreshTimer);
            callbackRef.current(null);
            setLoadError(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      callbackRef.current(null);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
    };
  // Recreate after every attempt: never leave a previously accepted token visible.
  }, [resetKey, retryKey]);

  if (!isTurnstileConfigured) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px] w-full" />
      {loadError ? (
        <div className="space-y-2 text-sm text-red-300" role="alert">
          <p>Sicherheitsprüfung konnte nicht abgeschlossen werden.</p>
          <button type="button" className="underline" onClick={() => setRetryKey((value) => value + 1)}>
            Sicherheitsprüfung erneut starten
          </button>
        </div>
      ) : null}
    </div>
  );
};
