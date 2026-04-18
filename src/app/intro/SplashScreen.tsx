import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Kurzer Marken-Beat (900–1100 ms), danach nur Welcome — nie direkt Home. */
const SPLASH_MS = 1000;

/**
 * Premium-Splash: dunkel, roter Glow, Wortmarke „SpielzeitApp“, feine Linie.
 * Keine Buttons, keine Hero-Szene; emotionaler Einstieg folgt auf WelcomeScreen.
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#020202] text-white"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Atmosphäre */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 72% at 50% 18%, rgba(185,28,28,0.38), transparent 56%), radial-gradient(ellipse 75% 50% at 75% 85%, rgba(69,10,10,0.32), transparent 52%), linear-gradient(180deg, #0c0a0a 0%, #000 55%, #030303 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-red-600/14 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.035) 5px, rgba(255,255,255,0.035) 6px)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 88% 78% at 50% 48%, transparent 32%, rgba(0,0,0,0.72) 100%)',
        }}
        aria-hidden
      />

      {/* Markenkern */}
      <div className="intro-splash-mark relative z-10 flex flex-col items-center text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
          style={{
            background: 'radial-gradient(ellipse closest-side, rgba(220,38,38,0.14), transparent 70%)',
            filter: 'blur(18px)',
          }}
          aria-hidden
        />

        <h1
          className="relative font-black italic leading-none tracking-tight drop-shadow-[0_4px_28px_rgba(0,0,0,0.85)]"
          style={{ transform: 'skewX(-4deg)' }}
        >
          <span className="text-[clamp(1.65rem,7vw,2.15rem)] text-white">Spielzeit</span>
          <span className="text-[clamp(1.65rem,7vw,2.15rem)] text-[#f87171]">App</span>
        </h1>

        <div
          className="intro-splash-line relative mx-auto mt-5 h-px w-[5.5rem] bg-gradient-to-r from-transparent via-red-500/55 to-transparent sm:w-24"
          aria-hidden
        />
      </div>
    </div>
  );
};
