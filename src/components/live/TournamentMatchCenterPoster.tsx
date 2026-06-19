import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { getClubLogo, hasKnownClubLogo, getTeamInitials } from '../../lib/teamLogos';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { MatchdayPosterArtwork } from '../feed/MatchdayPosterArtwork';
import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import { tournamentMatchDisplayStatus } from '../../lib/tournamentPlan';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { MC_SURFACE, MC_POSTER_SHELL, MC_POSTER_SHADOW } from './matchCenterStyles';

type Props = {
  slot: TournamentMatchSlotView;
  ourTeamName: string;
  tournamentTitle: string;
  participantLogoByName?: ReadonlyMap<string, string | null>;
};

function resolveLogo(name: unknown, map?: ReadonlyMap<string, string | null>): string {
  const url = map?.get(safeText(name).toLowerCase());
  return getClubLogo(name, { logoUrl: url ?? undefined });
}

function TournamentTeamLogo({
  name,
  map,
}: {
  name: string;
  map?: ReadonlyMap<string, string | null>;
}) {
  const logoUrl = map?.get(safeText(name).toLowerCase()) ?? null;
  const known = hasKnownClubLogo(name, { logoUrl });
  const src = known ? resolveLogo(name, map) : null;
  const [failed, setFailed] = React.useState(false);

  if (!known || failed) {
    return (
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${MC_SURFACE} text-[11px] font-bold text-white/80`}>
        {getTeamInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt=""
      className="h-10 w-10 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function TournamentMatchCenterPoster({
  slot,
  ourTeamName,
  tournamentTitle,
  participantLogoByName,
}: Props) {
  const homeTeam = safeText(ourTeamName) || 'Unser Team';
  const awayTeam = safeText(slot.opponent_name) || 'Gegner';
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
    <div className={MC_POSTER_SHELL} style={{ boxShadow: MC_POSTER_SHADOW }}>
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
      <p className="flex items-center justify-center gap-1.5 border-t border-white/[0.05] py-1 text-[11px] leading-tight text-white/55">
        <CalendarDays className="h-3 w-3 shrink-0 text-red-400/80" strokeWidth={2.25} aria-hidden />
        Spielplan folgt in Kürze
      </p>
    );
  }

  const homeTeam = safeText(ourTeamName) || 'Unser Team';
  const awayTeam = safeText(slot.opponent_name) || 'Gegner';
  const dateParts = formatHeroDateParts(slot.kickoff_at);
  const kickoff = formatTimeHHmmDe(slot.kickoff_at);

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/38">
        Erstes Spiel
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <TournamentTeamLogo name={homeTeam} map={participantLogoByName} />
          <p className="w-full truncate text-center text-[10px] font-semibold text-white/88" title={homeTeam}>
            {homeTeam}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
          vs
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <TournamentTeamLogo name={awayTeam} map={participantLogoByName} />
          <p className="w-full truncate text-center text-[10px] font-semibold text-white/88" title={awayTeam}>
            {awayTeam}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 text-[10px] text-white/58">
        <span>
          {dateParts.wd} {dateParts.day}. {dateParts.mon}
        </span>
        <span className="font-semibold tabular-nums text-white/82">{kickoff} Uhr</span>
      </div>
    </div>
  );
}
