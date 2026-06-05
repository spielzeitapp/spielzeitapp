import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PlayerMatchdayPosterArtwork } from '../../components/feed/PlayerMatchdayPosterArtwork';

/**
 * Dev-Preview: Player Matchday Poster — nur per Direkt-URL, keine Nav-Verlinkung.
 */
export const PlayerMatchdayPosterPreviewPage: React.FC = () => {
  return (
    <div
      className="page player-matchday-poster-preview min-h-[60vh] w-full px-3 pb-28 pt-3 sm:px-4"
      style={{
        background:
          'linear-gradient(180deg, rgba(28,4,4,0.98) 0%, rgba(14,0,0,0.99) 55%, rgba(8,0,0,1) 100%)',
        boxShadow: 'inset 0 0 100px rgba(120,20,20,0.1)',
      }}
    >
      <div className="mx-auto w-full max-w-[430px] space-y-4">
        <Link
          to="/app/home"
          className="inline-flex items-center gap-1 text-sm font-medium text-white/65 transition-colors hover:text-white/90"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Zurück
        </Link>

        <header className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Player Matchday Poster Preview
          </h1>
          <p className="text-xs text-white/50">Prototyp — Daniel-Cutout, hardcoded Demo-Daten</p>
        </header>

        <div className="overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(220,38,38,0.14),0_24px_48px_-14px_rgba(0,0,0,0.85)]">
          <PlayerMatchdayPosterArtwork />
        </div>
      </div>
    </div>
  );
};
