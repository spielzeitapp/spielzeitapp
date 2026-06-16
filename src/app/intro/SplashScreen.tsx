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
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black px-4"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <img
        src={spielzeitappSplash}
        alt={APP_SPLASH_ALT}
        className="intro-splash-mark mx-auto h-auto w-full max-h-[min(70svh,26rem)] max-w-[min(92vw,22rem)] object-contain"
        width={1536}
        height={1024}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
};
