import React from 'react';
import { Link } from 'react-router-dom';

const logo = import.meta.env.BASE_URL + 'logos/nsg-goelsental.png';

export const HomePage: React.FC = () => {
  return (
    <div
      className="page home-page relative flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-8"
      style={{
        background: 'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center gap-6 text-center">
        <img
          src={logo}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full object-cover"
          width={64}
          height={64}
        />
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">
          NSG SpielzeitApp
        </h1>
        <p className="text-sm text-white/90 sm:text-base">
          Spielplan, Spielzeiten und Infos für Eltern, Spieler und Fans.
        </p>

        <Link
          to="/schedule"
          className="flex h-14 w-full max-w-[320px] items-center justify-center rounded-xl bg-red-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-500 active:scale-[0.98]"
        >
          Spielplan öffnen
        </Link>

        <p className="text-center text-xs text-white/60">
          📲 Tipp: Zum Home-Bildschirm hinzufügen für App-Modus
        </p>
      </div>
    </div>
  );
};
