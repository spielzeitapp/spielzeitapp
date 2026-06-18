import React, { useMemo } from 'react';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { getClubLogo } from '../../lib/teamLogos';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import {
  MatchdayPosterArtwork,
} from '../feed/MatchdayPosterArtwork';
import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import { tournamentMatchDisplayStatus } from '../../lib/tournamentPlan';

type Props = {
  slot: TournamentMatchSlotView;
  ourTeamName: string;
  tournamentTitle: string;
  participantLogoByName?: ReadonlyMap<string, string | null>;
};

function resolveLogo(name: string, map?: ReadonlyMap<string, string | null>): string {
  const url = map?.get(name.trim().toLowerCase());
  return getClubLogo(name, { logoUrl: url ?? undefined });
}

export function TournamentMatchCenterPoster({
  slot,
  ourTeamName,
  tournamentTitle,
  participantLogoByName,
}: Props) {
  const homeTeam = ourTeamName.trim() || 'Unser Team';
  const awayTeam = slot.opponent_name.trim() || 'Gegner';
  const kickoff = formatTimeHHmmDe(slot.kickoff_at);
  const phaseLabel = tournamentPhaseDisplayLabel(slot.phase, slot.group_label);
  const display = tournamentMatchDisplayStatus(slot);

  const visualStatus = useMemo((): 'today' | 'live' | 'finished' => {
    if (display.kind === 'live') return 'live';
    if (display.kind === 'result') return 'finished';
    return 'today';
  }, [display.kind]);

  const heroOverride =
    display.kind === 'result'
      ? {
          main: `${display.ourGoals} : ${display.oppGoals}`,
          suffix: 'ENDSTAND' as const,
          livePulse: false,
        }
      : display.kind === 'live'
        ? { main: 'LIVE', suffix: null, livePulse: true }
        : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-500/35 shadow-[0_0_32px_rgba(220,38,38,0.14),0_16px_40px_rgba(0,0,0,0.55)]">
      <MatchdayPosterArtwork
        statusLabel={phaseLabel.toUpperCase()}
        title="TOP-SPIEL"
        homeTeamName={homeTeam}
        awayTeamName={awayTeam}
        homeLogoUrl={resolveLogo(homeTeam, participantLogoByName)}
        awayLogoUrl={resolveLogo(awayTeam, participantLogoByName)}
        kickoffTime={`${kickoff} Uhr`}
        meetingTime={null}
        location={tournamentTitle}
        competitionLabel={phaseLabel}
        isHomeGame
        heroOverride={heroOverride}
        showAnpfiffLabel={visualStatus === 'today'}
        statusBadge={
          display.kind === 'live'
            ? 'LIVE'
            : display.kind === 'result'
              ? `ENDSTAND ${display.ourGoals}:${display.oppGoals}`
              : null
        }
        compact
      />
    </div>
  );
}

export function TournamentFirstMatchPreview({
  slot,
  ourTeamName,
  participantLogoByName,
}: {
  slot: TournamentMatchSlotView | null;
  ourTeamName: string;
  participantLogoByName?: ReadonlyMap<string, string | null>;
}) {
  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 bg-black/25 px-3 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
          Erstes Spiel
        </p>
        <p className="mt-2 text-[13px] font-medium text-white/55">Spielplan folgt</p>
      </div>
    );
  }

  const homeTeam = ourTeamName.trim() || 'Unser Team';
  const awayTeam = slot.opponent_name.trim() || 'Gegner';
  const dateParts = formatHeroDateParts(slot.kickoff_at);
  const kickoff = formatTimeHHmmDe(slot.kickoff_at);

  return (
    <div className="rounded-2xl border border-[rgba(220,38,38,0.22)] bg-black/35 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75">
        Erstes Spiel
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <img
            src={resolveLogo(homeTeam, participantLogoByName)}
            alt=""
            className="h-10 w-10 object-contain"
          />
          <p className="line-clamp-2 w-full text-center text-[10px] font-semibold leading-snug text-white/88">
            {homeTeam}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
          vs
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <img
            src={resolveLogo(awayTeam, participantLogoByName)}
            alt=""
            className="h-10 w-10 object-contain"
          />
          <p className="line-clamp-2 w-full text-center text-[10px] font-semibold leading-snug text-white/88">
            {awayTeam}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/62">
        <span>
          {dateParts.wd} {dateParts.day}. {dateParts.mon}
        </span>
        <span className="font-semibold tabular-nums text-white/82">{kickoff} Uhr</span>
      </div>
    </div>
  );
}
