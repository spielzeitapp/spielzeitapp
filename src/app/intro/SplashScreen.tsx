import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readPendingParentEmailInviteFlag, resolvePendingParentInvitePath } from '../../lib/parentLinkInvites';

const APP_SPLASH_ALT = 'SpielzeitApp';
const SPLASH_LOGO_PATH = `${import.meta.env.BASE_URL || '/'}intro/welcome-logo-clean.png`;

/** Kurzer Marken-Beat (~1000 ms), danach nur Welcome — nie direkt Home. */
const SPLASH_MS = 1000;

/**
 * Marken-Splash: neues Logo auf einem ruhigen rot-schwarzen Hintergrund.
 * Keine Buttons und kein Slogan – die Botschaft folgt auf der Welcome-Seite.
 * Demo und App teilen dieselbe Komponente — Zielpfad hängt vom aktuellen Prefixe ab.
 * Pending Eltern-Einladung überspringt Splash → Accept-Seite.
 */
export const SplashScreen: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDemo = pathname.startsWith('/demo');

  useEffect(() => {
    if (!isDemo) {
      const pending = resolvePendingParentInvitePath();
      if (pending) {
        window.location.replace(pending);
        return;
      }
      if (readPendingParentEmailInviteFlag()) {
        window.location.replace('/app/parent-invite');
        return;
      }
    }
    const t = window.setTimeout(() => {
      navigate(isDemo ? '/demo/intro/welcome' : '/app/intro/welcome', { replace: true });
    }, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [navigate, isDemo]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center overflow-hidden bg-black">
      <div
        className="relative flex h-full min-h-full w-full max-w-md items-center justify-center overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(185,28,28,0.34) 0%, rgba(74,8,12,0.18) 31%, transparent 57%), linear-gradient(155deg, #170305 0%, #070708 44%, #120204 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute -left-24 top-[9%] h-3 w-[70%] -rotate-45 bg-gradient-to-r from-transparent via-red-600/55 to-transparent blur-[0.5px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 bottom-[12%] h-3 w-[70%] -rotate-45 bg-gradient-to-r from-transparent via-red-700/45 to-transparent blur-[0.5px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(120deg, transparent 0%, transparent 49.5%, rgba(255,45,45,0.12) 50%, transparent 50.5%, transparent 100%)',
            backgroundSize: '86px 86px',
          }}
          aria-hidden
        />
        <div className="relative z-10 flex w-full -translate-y-[3vh] justify-center px-7">
          <img
            src={SPLASH_LOGO_PATH}
            alt={APP_SPLASH_ALT}
            className="intro-splash-mark h-auto w-full max-w-[22rem] object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.2)]"
            width={1200}
            height={378}
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>
    </div>
  );
};
