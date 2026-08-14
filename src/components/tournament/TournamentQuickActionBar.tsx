import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CenterQuickActionBar } from '../center/CenterQuickActionBar';
import {
  publicTeamTournamentPath,
  sharePublicTeamTournamentPage,
} from '../../lib/publicTeamTournament';
import { shareTournamentCenter } from './tournamentCenterUtils';

type Props = {
  shareTitle: string;
  tournamentEventId: string;
  onAddToCalendar: () => void;
  onNavigate?: () => void;
  showNavigation?: boolean;
};

export function TournamentQuickActionBar({
  shareTitle,
  tournamentEventId,
  onAddToCalendar,
  onNavigate,
  showNavigation = false,
}: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const publicPath = publicTeamTournamentPath(tournamentEventId);

  const handleSharePublic = async () => {
    const result = await sharePublicTeamTournamentPage(shareTitle, tournamentEventId);
    setHint(
      result === 'shared' ? 'Turnierseite geteilt' : result === 'copied' ? 'Turnierseite-Link kopiert' : 'Teilen nicht verfügbar',
    );
    window.setTimeout(() => setHint(null), 2200);
  };

  return (
    <div className="space-y-2">
      <CenterQuickActionBar
        onAddToCalendar={onAddToCalendar}
        onNavigate={onNavigate}
        showNavigation={showNavigation}
        onShare={() => shareTournamentCenter(shareTitle)}
      />
      <div className="flex flex-wrap gap-2">
        <Link
          to={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[34px] items-center rounded-full border border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.08)] px-3 py-1.5 text-[11px] font-semibold text-red-100 touch-manipulation"
        >
          Turnierseite ansehen
        </Link>
        <button
          type="button"
          onClick={() => void handleSharePublic()}
          className="inline-flex min-h-[34px] items-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/85 touch-manipulation"
        >
          Turnierseite teilen
        </button>
      </div>
      {hint ? (
        <p className="text-[10px] text-white/65" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
