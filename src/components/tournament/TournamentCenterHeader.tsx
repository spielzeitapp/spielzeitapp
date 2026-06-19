import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Share2 } from 'lucide-react';
import { shareTournamentCenter } from './tournamentCenterUtils';

type Props = {
  shareTitle: string;
};

export function TournamentCenterHeader({ shareTitle }: Props) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const handleShare = async () => {
    const ok = await shareTournamentCenter(shareTitle);
    setShareHint(ok ? 'Link kopiert' : 'Teilen nicht verfügbar');
    window.setTimeout(() => setShareHint(null), 2200);
  };

  return (
    <header className="relative flex min-h-[44px] items-center justify-between gap-2">
      <Link
        to="/app/termine"
        className="inline-flex min-h-[44px] min-w-[44px] items-center gap-0.5 rounded-full pr-2 text-[14px] font-medium text-white/85 touch-manipulation hover:text-white"
        aria-label="Zurück zum Spielplan"
      >
        <ChevronLeft className="h-5 w-5 shrink-0 text-red-400/90" strokeWidth={2.25} aria-hidden />
        <span className="sr-only sm:not-sr-only">Zurück</span>
      </Link>

      <h1 className="pointer-events-none absolute left-1/2 top-1/2 max-w-[min(52vw,12rem)] -translate-x-1/2 -translate-y-1/2 truncate text-center text-[17px] font-bold leading-none tracking-tight text-white">
        Turniercenter
      </h1>

      <button
        type="button"
        onClick={() => void handleShare()}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[rgba(255,71,71,0.18)] bg-[rgba(255,71,71,0.06)] text-red-300/90 touch-manipulation hover:border-[rgba(255,71,71,0.32)] hover:bg-[rgba(255,71,71,0.1)]"
        aria-label="Turniercenter teilen"
      >
        <Share2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </button>

      {shareHint ? (
        <span
          className="pointer-events-none absolute -bottom-7 right-0 z-10 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white/80"
          role="status"
        >
          {shareHint}
        </span>
      ) : null}
    </header>
  );
}
