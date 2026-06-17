import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import spielzeitappSplash from '../../assets/branding/spielzeitapp-splash.png';

const APP_SPLASH_ALT = 'SpielzeitApp – TEAMS LIVE MOMENTE';

/** Kurzer Marken-Beat (~1000 ms), danach nur Welcome — nie direkt Home. */
const SPLASH_MS = 1000;

/**
 * Marken-Splash: schwarzer Hintergrund, zentriertes Splash-Bild.
 * Keine Buttons, keine zusätzlichen Texte.
 */
export const SplashScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate('/app/intro/welcome', { replace: true });
    }, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [navigate]);

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
