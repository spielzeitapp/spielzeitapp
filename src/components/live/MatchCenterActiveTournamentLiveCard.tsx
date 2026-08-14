import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Trophy } from 'lucide-react';
import type { ActiveTournamentLiveContext } from '../../lib/matchCenterTournamentLive';
import {
  formatTournamentLiveClock,
  formatTournamentLivePhaseLabel,
} from '../../lib/matchCenterTournamentLive';
import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { eventNotesTitle } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MC_BORDER_STRONG, MC_SURFACE } from './matchCenterStyles';

type Props = {
  context: ActiveTournamentLiveContext;
  ourTeamName: string;
};

function TeamLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const [failed, setFailed] = React.useState(false);
  const known = hasKnownClubLogo(name, { logoUrl });
  const src = known ? getClubLogo(name, { logoUrl }) : null;

  if (!known || failed) {
    return (
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${MC_SURFACE} text-[11px] font-bold text-white/75`}>
        {getTeamInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt=""
      className="h-12 w-12 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      onError={() => setFailed(true)}
    />
  );
}

export function MatchCenterActiveTournamentLiveCard({ context, ourTeamName }: Props) {
  const { tournamentEvent, slot, participants, liveDetails } = context;
  const tournamentTitle =
    safeText(
      eventNotesTitle(tournamentEvent.notes) ??
        safeOptionalText(tournamentEvent.opponent) ??
        'Turnier',
    ) || 'Turnier';
  const homeTeam = safeText(ourTeamName) || 'Unser Team';
  const awayTeam = safeText(slot.opponent_name) || 'Gegner';

  const logoByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of participants) {
      map.set(safeText(p.name).toLowerCase(), safeOptionalText(p.logoUrl));
    }
    return map;
  }, [participants]);

  const awayLogoUrl = logoByName.get(awayTeam.toLowerCase()) ?? null;
  const phaseLabel = tournamentPhaseDisplayLabel(slot.phase, slot.group_label);
  const livePhase = formatTournamentLivePhaseLabel(liveDetails.livePeriod);
  const clockLabel = formatTournamentLiveClock(
    liveDetails.liveElapsedSeconds,
    slot.planned_minutes ?? 12,
  );
  const scoreLine = `${liveDetails.scoreHome} : ${liveDetails.scoreAway}`;
  const liveHref = `/app/live?matchId=${encodeURIComponent(slot.match_id ?? '')}`;

  return (
    <article
      className={`relative overflow-hidden rounded-[20px] border ${MC_BORDER_STRONG} bg-[#060608] shadow-[0_0_36px_rgba(255,71,71,0.16),0_16px_48px_rgba(0,0,0,0.58)]`}
    >
      <div className="border-b border-[rgba(255,71,71,0.18)] bg-[rgba(255,71,71,0.06)] px-3.5 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/90">
            Aktuelles Turnierspiel LIVE
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/45 bg-red-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100">
            <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} aria-hidden />
            Live
          </span>
        </div>
        <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium text-white/62">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300/85" strokeWidth={2} aria-hidden />
          <span className="truncate">{tournamentTitle}</span>
        </p>
      </div>

      <div className="px-3.5 py-4 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <TeamLogo name={homeTeam} />
            <p className="max-w-[5.5rem] truncate text-center text-[11px] font-semibold text-white/88">
              {homeTeam}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center px-1">
            <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight text-white">
              {scoreLine}
            </p>
            <p className="mt-1 text-[11px] font-semibold tabular-nums text-red-200/90">{clockLabel}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/45">
              {livePhase}
              {phaseLabel !== 'Turnierspiel' ? ` · ${phaseLabel}` : ''}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <TeamLogo name={awayTeam} logoUrl={awayLogoUrl} />
            <p className="max-w-[5.5rem] truncate text-center text-[11px] font-semibold text-white/88">
              {awayTeam}
            </p>
          </div>
        </div>

        {safeOptionalText(slot.pitch) ? (
          <p className="mt-3 text-center text-[11px] text-white/45">{safeText(slot.pitch)}</p>
        ) : null}

        <Link
          to={liveHref}
          className={`${dsPrimaryCtaClass()} mt-4 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-5 py-3 text-[15px] font-semibold`}
        >
          Zum Live-Spiel
        </Link>
      </div>
    </article>
  );
}
