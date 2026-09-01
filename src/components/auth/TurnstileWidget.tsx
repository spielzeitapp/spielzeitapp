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

  callbackRef.current = onTokenChange;

  useEffect(() => {
    if (!isTurnstileConfigured || !containerRef.current) return;
    let cancelled = false;

    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => callbackRef.current(token),
          'expired-callback': () => callbackRef.current(null),
          'error-callback': () => {
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
      callbackRef.current(null);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    callbackRef.current(null);
    setLoadError(false);
    window.turnstile.reset(widgetId);
  }, [resetKey]);

  if (!isTurnstileConfigured) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px] w-full" />
      {loadError ? (
        <p className="text-sm text-red-300" role="alert">
          Sicherheitsprüfung konnte nicht geladen werden. Bitte Seite neu laden.
        </p>
      ) : null}
    </div>
  );
};
