import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import spielzeitappSplash from '../../assets/branding/spielzeitapp-splash.png';
import { resolvePendingParentInvitePath } from '../../lib/parentLinkInvites';

const APP_SPLASH_ALT = 'SpielzeitApp – TEAMS LIVE MOMENTE';

/** Kurzer Marken-Beat (~1000 ms), danach nur Welcome — nie direkt Home. */
const SPLASH_MS = 1000;

/**
 * Marken-Splash: schwarzer Hintergrund, zentriertes Splash-Bild.
 * Keine Buttons, keine zusätzlichen Texte.
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
        window.location.assign(pending);
        return;
      }
    }
    const t = window.setTimeout(() => {
      navigate(isDemo ? '/demo/intro/welcome' : '/app/intro/welcome', { replace: true });
    }, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [navigate, isDemo]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-black px-3"
      style={{
        paddingTop: 'max(14vh, calc(3.75rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <img
        src={spielzeitappSplash}
        alt={APP_SPLASH_ALT}
        className="intro-splash-mark mx-auto h-auto w-full max-h-[min(82svh,34rem)] max-w-[min(94vw,29rem)] object-contain object-top"
        width={853}
        height={1844}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
};
