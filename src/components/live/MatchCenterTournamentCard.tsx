import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
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
import { VIENNA_TZ } from '../../lib/viennaTime';
import { eventNotesTitle, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';
import { ParticipantLogoChip } from './ParticipantLogoChip';
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

function formatTournamentInfoDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function TournamentCompactStats({
  teamsDisplay,
  matchesDisplay,
  winnerDisplay,
}: {
  teamsDisplay: number | null;
  matchesDisplay: number | null;
  winnerDisplay: string;
}) {
  const winnerLabel =
    winnerDisplay === 'Offen' || winnerDisplay === '—'
      ? 'offen'
      : winnerDisplay;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/58">
      {teamsDisplay != null ? (
        <span className="whitespace-nowrap">
          <span aria-hidden>👥 </span>
          {teamsDisplay} Teams
        </span>
      ) : null}
      {matchesDisplay != null ? (
        <span className="whitespace-nowrap">
          <span aria-hidden>⚽ </span>
          {matchesDisplay} Spiele
        </span>
      ) : null}
      <span className="whitespace-nowrap">
        <span aria-hidden>🏆 </span>
        Sieger {winnerLabel}
      </span>
    </div>
  );
}

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
  const infoDate = formatTournamentInfoDate(event.starts_at);
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
    <article className="relative overflow-hidden rounded-[20px] bg-[#060608] shadow-[0_20px_56px_rgba(0,0,0,0.72)] ring-1 ring-white/[0.04]">
      {/* Hero — dominant, weniger Abdunklung */}
      <div className="relative min-h-[15.5rem] w-full overflow-hidden sm:min-h-[17.5rem]">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_28%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.48)_0%,rgba(0,0,0,0.06)_32%,rgba(0,0,0,0.28)_68%,rgba(6,4,6,0.82)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_15%,rgba(255,248,235,0.1)_0%,transparent_58%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col justify-between px-3 pb-3 pt-2 sm:px-4 sm:pb-3.5">
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-white/[0.08] bg-black/35 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-white/75 backdrop-blur-[2px]">
            <Trophy
              className="h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>

          <div className="mt-auto pt-4">
            <h2 className="text-[20px] font-bold leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-[23px]">
              {title}
            </h2>
          </div>
        </div>
      </div>

      <div className="relative bg-[#060608] px-3 pb-2.5 pt-2 sm:px-4 sm:pb-3">
        {/* Kompakte Info-Leiste direkt unter Hero */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-white/[0.05] pb-2 text-[11px] leading-snug text-white/62">
          <span className="whitespace-nowrap">
            <span aria-hidden>📅 </span>
            {infoDate}
          </span>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <span className="whitespace-nowrap">
            <span aria-hidden>🕙 </span>
            {kickoff} Uhr
          </span>
          {place ? (
            <>
              <span className="text-white/25" aria-hidden>
                ·
              </span>
              <span className="min-w-0 truncate">
                <span aria-hidden>📍 </span>
                {place}
              </span>
            </>
          ) : null}
        </div>

        {countdown ? (
          <div className="mt-2">
            <MatchCenterCountdown parts={countdown} variant="heroCompact" />
          </div>
        ) : null}

        {!loadingExtras && (teamsDisplay != null || matchesDisplay != null || winnerDisplay) ? (
          <div className="mt-2">
            <TournamentCompactStats
              teamsDisplay={teamsDisplay}
              matchesDisplay={matchesDisplay}
              winnerDisplay={winnerDisplay}
            />
          </div>
        ) : null}

        {!loadingExtras && topMatch ? (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/38">
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
          <div className="mt-3">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/38">
              Teilnehmende Mannschaften
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pl-1 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <div className="mt-2.5">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={`/app/events/${event.id}`}
          className={`${dsPrimaryCtaClass()} mt-2.5 mb-[max(0.25rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Zum Turniercenter
        </Link>
      </div>
    </article>
  );
}
