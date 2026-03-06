import React from 'react';
import { useNavigate } from 'react-router-dom';

const LOGO_SRC = `${import.meta.env.BASE_URL}logos/nsg-goelsental.png`;

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center overflow-hidden px-6 py-10 mx-auto"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Subtle red glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(255,0,40,0.18) 0%, transparent 65%)',
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 85% at 50% 50%, transparent 25%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      {/* Logo Watermark */}
      <img
        src={LOGO_SRC}
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[min(80vw,320px)] w-[min(80vw,320px)] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.06] blur-sm"
        aria-hidden
      />

      <div className="relative z-20 flex w-full max-w-[400px] flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)] drop-shadow-sm">
            SpielzeitApp
          </h1>
          <p className="mt-3 text-lg font-medium text-[var(--text-main)] welcome-claim">
            Ein Team. Eine App. Ein Gefühl.
          </p>
          <p className="mt-2 text-sm text-[var(--text-sub)]">
            Live-Spielstand, Spielzeiten & alle Infos für Eltern und Fans.
          </p>
        </div>

        <div className="card w-full p-8">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => navigate('/live')}
              className="btn btn-primary h-14 w-full"
            >
              Live-Spiel öffnen
            </button>
            <button
              type="button"
              onClick={() => navigate('/schedule')}
              className="btn btn-secondary h-14 w-full"
            >
              Spielplan & Infos
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--text-sub)]">
          📲 Tipp: Zum Home-Bildschirm hinzufügen für App-Modus
        </p>
      </div>
    </div>
  );
};
