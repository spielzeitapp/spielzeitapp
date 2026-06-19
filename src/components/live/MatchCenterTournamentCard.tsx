import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Trophy } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import {
  computeMatchCenterCountdown,
  isRudolfSteurerGedenkturnier,
  RUDOLF_STEUrer_DEMO_PARTICIPANTS,
} from '../../lib/matchCenterUtils';
import {
  type MatchCenterParticipant,
  pickTournamentFirstMatch,
  pickTournamentTopMatch,
  resolveTournamentCoverUrl,
  resolveTournamentWinnerDisplay,
} from '../../lib/matchCenterTournamentVisuals';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { eventNotesTitle } from '../schedule/scheduleEventViewUtils';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';
import { ParticipantLogoChip } from './ParticipantLogoChip';
import { TournamentPremiumStatBadge } from './TournamentPremiumStatBadge';
import { MC_BORDER } from './matchCenterStyles';
import {
  TournamentFirstMatchPreview,
  TournamentMatchCenterPoster,
} from './TournamentMatchCenterPoster';

type Props = {
  event: EventRow;
  ourTeamName: string;
  now: Date;
  teamCount: number | null;
  matchCount: number | null;
  participants: MatchCenterParticipant[];
  slots: TournamentMatchSlotView[];
  tournamentCompleted?: boolean;
  loadingExtras?: boolean;
};

export function MatchCenterTournamentCard({
  event,
  ourTeamName,
  now,
  teamCount,
  matchCount,
  participants,
  slots,
  tournamentCompleted = false,
  loadingExtras = false,
}: Props) {
  const title = (eventNotesTitle(event.notes) ?? event.opponent ?? 'Turnier').trim() || 'Turnier';
  const premium = isRudolfSteurerGedenkturnier(title);
  const coverUrl = resolveTournamentCoverUrl(event);

  const countdown = useMemo(
    () => computeMatchCenterCountdown(event.starts_at, now),
    [event.starts_at, now],
  );
  const dateParts = formatHeroDateParts(event.starts_at);
  const kickoff = formatTimeHHmmDe(event.starts_at);
  const parsedLocation = splitCombinedLocation(event.location);
  const place = formatFullLocation(parsedLocation.place, parsedLocation.address || (event.address ?? ''));

  const carouselTeams = useMemo((): MatchCenterParticipant[] => {
    if (participants.length > 0) return participants;
    if (premium) {
      return RUDOLF_STEUrer_DEMO_PARTICIPANTS.map((name) => ({ name, logoUrl: null }));
    }
    return [];
  }, [participants, premium]);

  const logoByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of carouselTeams) {
      map.set(p.name.trim().toLowerCase(), p.logoUrl ?? null);
    }
    return map;
  }, [carouselTeams]);

  const teamsDisplay = teamCount ?? (carouselTeams.length > 0 ? carouselTeams.length : null);
  const matchesDisplay = matchCount;
  const winnerDisplay = resolveTournamentWinnerDisplay(slots, ourTeamName, tournamentCompleted);
  const topMatch = pickTournamentTopMatch(slots);
  const firstMatch = pickTournamentFirstMatch(slots);

  return (
    <article className="relative overflow-hidden rounded-[20px] bg-[#08080a] shadow-[0_20px_56px_rgba(0,0,0,0.68),0_0_48px_rgba(255,71,71,0.06)] ring-1 ring-white/[0.04]">
      {/* Hero — volle Breite, Home-Hero-Feeling */}
      <div className="relative min-h-[13.5rem] w-full overflow-hidden sm:min-h-[15.5rem]">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_30%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.18)_38%,rgba(0,0,0,0.55)_72%,rgba(6,4,6,0.96)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_20%,rgba(255,248,235,0.08)_0%,transparent_55%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col justify-between px-3 pb-3.5 pt-[max(0.65rem,env(safe-area-inset-top,0px))] sm:px-4 sm:pb-4">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border ${MC_BORDER} bg-[rgba(4,4,6,0.55)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100 backdrop-blur-[3px]`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2} aria-hidden />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>

          <div className="mt-auto pt-6">
            <h2 className="text-[21px] font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:text-[24px]">
              {title}
            </h2>
          </div>
        </div>
      </div>

      {/* Inhalt — kompakt unter dem Hero */}
      <div className="relative bg-[#08080a] px-3 py-3 sm:px-4 sm:py-3.5">
        {countdown ? (
          <div className="mb-3">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[rgba(255,120,120,0.72)]">
              Countdown bis Beginn
            </p>
            <MatchCenterCountdown parts={countdown} variant="heroCompact" />
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-[12px] text-white/72">
          <span
            className={`inline-flex min-w-[3rem] flex-col items-center rounded-lg border ${MC_BORDER} bg-[rgba(6,4,8,0.55)] px-2 py-1`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-[rgba(255,120,120,0.82)]">
              {dateParts.wd}
            </span>
            <span className="text-[18px] font-bold leading-none text-white">{dateParts.day}</span>
            <span className="text-[10px] font-semibold uppercase text-white/55">{dateParts.mon}</span>
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
              <span>Beginn {kickoff} Uhr</span>
            </p>
            {place ? (
              <p className="inline-flex min-w-0 items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                <span className="min-w-0 break-words leading-snug">{place}</span>
              </p>
            ) : null}
          </div>
        </div>

        {!loadingExtras && (teamsDisplay != null || matchesDisplay != null || winnerDisplay) ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            {teamsDisplay != null ? (
              <TournamentPremiumStatBadge label="Teams" value={teamsDisplay} accent="red" />
            ) : null}
            {matchesDisplay != null ? (
              <TournamentPremiumStatBadge label="Spiele" value={matchesDisplay} accent="neutral" />
            ) : null}
            <TournamentPremiumStatBadge
              label="Sieger"
              value={winnerDisplay}
              accent={winnerDisplay !== 'Offen' && winnerDisplay !== '—' ? 'gold' : 'neutral'}
            />
          </div>
        ) : null}

        {!loadingExtras && topMatch ? (
          <div className="mt-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              Top-Spiel des Turniers
            </p>
            <TournamentMatchCenterPoster
              slot={topMatch}
              ourTeamName={ourTeamName}
              tournamentTitle={title}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        {carouselTeams.length > 0 ? (
          <div className="mt-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              Teilnehmende Mannschaften
            </p>
            <div className="-mx-1 flex gap-2.5 overflow-x-auto pb-1 pl-1 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {carouselTeams.map((p) => (
                <ParticipantLogoChip
                  key={p.name}
                  teamName={p.name}
                  logoUrl={p.logoUrl}
                  carousel
                />
              ))}
            </div>
          </div>
        ) : null}

        {!loadingExtras ? (
          <div className="mt-3.5">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={`/app/events/${event.id}`}
          className={`${dsPrimaryCtaClass()} mt-3.5 mb-[max(0.25rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Zum Turniercenter
        </Link>
      </div>
    </article>
  );
}
