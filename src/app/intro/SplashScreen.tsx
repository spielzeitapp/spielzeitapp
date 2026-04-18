import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Kurzer Marken-Beat (~1000 ms), danach nur Welcome — nie direkt Home. */
const SPLASH_MS = 1000;

/**
 * Premium-Splash: tiefschwarz, weicher Rot-Glow oben/mitte, dezente Vignette,
 * Wortmarke + feine Linie. Keine Buttons, keine Hero-Szene.
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#010101] text-white"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Tiefschwarz + weicher Rot-Glow (oben / mitte) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 70% at 50% 22%, rgba(127,29,29,0.28), transparent 58%), radial-gradient(ellipse 70% 45% at 50% 8%, rgba(220,38,38,0.12), transparent 50%), linear-gradient(180deg, #080606 0%, #010101 45%, #000 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-gradient-to-b from-red-600/11 to-transparent blur-[2.75rem]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.028) 6px, rgba(255,255,255,0.028) 7px)',
        }}
        aria-hidden
      />
      {/* Sehr dezente Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 92% 82% at 50% 50%, transparent 38%, rgba(0,0,0,0.58) 100%)',
        }}
        aria-hidden
      />

      <div className="intro-splash-mark relative z-10 flex flex-col items-center text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[13rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-75"
          style={{
            background: 'radial-gradient(ellipse closest-side, rgba(220,38,38,0.11), transparent 72%)',
            filter: 'blur(20px)',
          }}
          aria-hidden
        />

        <h1
          className="relative font-black italic leading-none tracking-tight"
          style={{
            transform: 'skewX(-3.5deg)',
            textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.35)',
          }}
        >
          <span className="text-[clamp(1.7rem,7.2vw,2.2rem)] text-[#fafafa]">Spielzeit</span>
          <span className="text-[clamp(1.7rem,7.2vw,2.2rem)] text-[#ef4444]">App</span>
        </h1>

        <div
          className="intro-splash-line relative mx-auto mt-[1.35rem] h-px w-[6rem] max-w-[88vw] bg-gradient-to-r from-transparent via-red-500/48 to-transparent sm:w-[6.25rem]"
          aria-hidden
        />
      </div>
    </div>
  );
};
