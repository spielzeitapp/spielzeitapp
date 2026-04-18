import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SPLASH_MS = 1050;

/**
 * Kurzer Vollbild-Splash (ca. 900–1200 ms), danach automatisch zum WelcomeScreen.
 * Ruhig, reduziert, Premium-Stadion-Nacht ohne verspielte Effekte.
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#030303] text-white"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 65% at 50% 22%, rgba(153,27,27,0.32), transparent 55%), radial-gradient(ellipse 70% 45% at 70% 88%, rgba(40,10,10,0.25), transparent 50%), linear-gradient(180deg, #0a0909 0%, #000 60%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 6px)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-red-900/15 to-transparent blur-3xl"
        aria-hidden
      />

      <div
        className="intro-splash-mark relative text-center"
        style={{ animation: 'introSplashMark 1.05s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.38em] text-white/40">Willkommen</p>
        <h1 className="font-black italic leading-none tracking-tight" style={{ transform: 'skewX(-4deg)' }}>
          <span className="text-xl text-white/90 sm:text-2xl">Spielzeit</span>
          <span className="text-xl text-red-500/95 sm:text-2xl">App</span>
        </h1>
        <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-red-600/45 to-transparent" />
      </div>
    </div>
  );
};
