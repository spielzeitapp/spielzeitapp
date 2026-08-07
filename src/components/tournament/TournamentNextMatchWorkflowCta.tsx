import React from 'react';
import { Link } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { matchPreparationPath } from '../../lib/matchPreparationAccess';
import {
  tournamentCenterPath,
  type TournamentMatchNavigationContext,
} from '../../lib/tournamentMatchNavigation';
import { formatTournamentKickoffTime } from '../../lib/tournamentPlan';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  context: TournamentMatchNavigationContext;
  className?: string;
};

/** CTAs nach beendetem Turnierspiel — nur manuelle Navigation, kein Auto-Redirect. */
export function TournamentNextMatchWorkflowCta({ context, className = '' }: Props) {
  const basePath = useInternalBasePath();
  const { nextSlot, tournamentEventId, tournamentTitle } = context;

  if (nextSlot) {
    const kickoff = formatTournamentKickoffTime(nextSlot.kickoff_at);
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200/85">
          {tournamentTitle}
        </p>
        <p className="text-center text-[12px] leading-snug text-white/65">
          Nächstes Spiel: {kickoff} Uhr vs {nextSlot.opponent_name}
        </p>
        <Link
          to={matchPreparationPath(nextSlot.match_id, basePath)}
          className={`${dsPrimaryCtaClass()} flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-bold`}
        >
          Nächstes Turnierspiel vorbereiten
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-center text-[12px] leading-snug text-white/55">
        Kein weiteres Turnierspiel geplant.
      </p>
      <Link
        to={tournamentCenterPath(tournamentEventId, basePath)}
        className={`${dsSecondaryCtaClass()} flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
      >
        Zurück zum Turniercenter
      </Link>
    </div>
  );
}

type PrepareButtonProps = {
  matchId: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
};

export function TournamentPrepareButton({
  matchId,
  className = '',
  variant = 'secondary',
  fullWidth = true,
}: PrepareButtonProps) {
  const basePath = useInternalBasePath();
  const ctaClass = variant === 'primary' ? dsPrimaryCtaClass() : dsSecondaryCtaClass();
  return (
    <Link
      to={matchPreparationPath(matchId, basePath)}
      className={`${ctaClass} inline-flex min-h-[40px] touch-manipulation items-center justify-center px-4 py-2 text-[13px] font-semibold ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      Vorbereiten
    </Link>
  );
}
