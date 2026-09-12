import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readPendingParentEmailInviteFlag, resolvePendingParentInvitePath } from '../../lib/parentLinkInvites';

const APP_SPLASH_ALT = 'SpielzeitApp – Unser Team. Unsere Momente. Unser Spiel.';
const SPLASH_IMAGE_PATH = `${import.meta.env.BASE_URL || '/'}intro/splash-clean.jpg`;

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
    <div
      className="fixed inset-0 z-[100] flex justify-center overflow-hidden bg-black"
    >
      <img
        src={SPLASH_IMAGE_PATH}
        alt={APP_SPLASH_ALT}
        className="intro-splash-mark h-full min-h-full w-full max-w-md object-cover object-center"
        width={941}
        height={1672}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
};
