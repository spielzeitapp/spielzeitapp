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
import { eventNotesTitle, formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
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

function splitPlaceDisplay(place: string): { label: string; detail: string } {
  const trimmed = place.trim();
  if (!trimmed) return { label: 'Ort', detail: '—' };
  const match = trimmed.match(/^(Sportplatz|Stadion|Arena|Halle)\s+(.+)$/i);
  if (match) {
    return { label: match[1]!, detail: match[2]!.trim() };
  }
  return { label: 'Ort', detail: trimmed };
}

function HeroGlassInfoBar({
  startsAt,
  place,
}: {
  startsAt: string | null | undefined;
  place: string;
}) {
  const dateParts = formatHeroDateParts(startsAt);
  const kickoff = formatTimeHHmmDe(startsAt);
  const { label: placeLabel, detail: placeDetail } = splitPlaceDisplay(place);

  return (
    <div className="mx-0 flex items-stretch gap-2 rounded-xl border border-white/10 bg-black/55 px-2.5 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <span className="inline-flex min-w-[2.85rem] shrink-0 flex-col items-center justify-center rounded-lg border border-[rgba(255,71,71,0.18)] bg-black/40 px-1.5 py-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-red-300/85">
          {dateParts.wd}
        </span>
        <span className="text-[17px] font-bold leading-none text-white">{dateParts.day}</span>
        <span className="text-[9px] font-semibold uppercase text-white/55">{dateParts.mon}</span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 border-r border-white/10 pr-2">
        <p className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/50">
          <Clock className="h-3 w-3 shrink-0 text-red-400/85" strokeWidth={2.25} aria-hidden />
          Beginn
        </p>
        <p className="text-[13px] font-semibold tabular-nums leading-tight text-white">{kickoff} Uhr</p>
      </div>

      {place ? (
        <div className="flex min-w-0 flex-[1.15] flex-col justify-center gap-0.5">
          <p className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/50">
            <MapPin className="h-3 w-3 shrink-0 text-red-400/85" strokeWidth={2.25} aria-hidden />
            {placeLabel}
          </p>
          <p className="truncate text-[12px] font-semibold leading-tight text-white/92" title={placeDetail}>
            {placeDetail}
          </p>
        </div>
      ) : null}
    </div>
  );
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-white/65">
      {teamsDisplay != null ? (
        <span className="whitespace-nowrap">
          <span aria-hidden>👥 </span>
          {teamsDisplay} Teams
        </span>
      ) : null}
      {teamsDisplay != null && (matchesDisplay != null || winnerDisplay) ? (
        <span className="text-white/20" aria-hidden>
          ·
        </span>
      ) : null}
      {matchesDisplay != null ? (
        <span className="whitespace-nowrap">
          <span aria-hidden>⚽ </span>
          {matchesDisplay} Spiele
        </span>
      ) : null}
      {matchesDisplay != null && winnerDisplay ? (
        <span className="text-white/20" aria-hidden>
          ·
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
    <article className="relative overflow-hidden rounded-[18px] bg-[#060608] shadow-[0_16px_48px_rgba(0,0,0,0.68)] ring-1 ring-white/[0.04]">
      <div className="relative min-h-[10rem] w-full overflow-hidden sm:min-h-[11.5rem]">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[72%_32%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.02)_28%,rgba(0,0,0,0.08)_52%,rgba(6,4,6,0.58)_100%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col px-3 pb-2 pt-1.5 sm:px-4">
          <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.07] bg-black/30 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/72 backdrop-blur-[2px]">
            <Trophy
              className="h-3 w-3 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>

          <div className="flex flex-1 flex-col justify-end pb-[4.35rem] pt-8">
            <h2 className="line-clamp-2 max-w-[62%] text-left text-[15px] font-bold leading-[1.14] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)] sm:max-w-[58%] sm:text-[17px]">
              {title}
            </h2>
          </div>

          <div className="absolute inset-x-3 bottom-2 sm:inset-x-4">
            <HeroGlassInfoBar startsAt={event.starts_at} place={place} />
          </div>
        </div>
      </div>

      <div className="relative bg-[#060608] px-3 pb-2 pt-1 sm:px-4 sm:pb-2.5">
        {countdown ? (
          <MatchCenterCountdown parts={countdown} variant="heroCompact" showHeader />
        ) : null}

        {!loadingExtras && (teamsDisplay != null || matchesDisplay != null || winnerDisplay) ? (
          <div className="mt-1">
            <TournamentCompactStats
              teamsDisplay={teamsDisplay}
              matchesDisplay={matchesDisplay}
              winnerDisplay={winnerDisplay}
            />
          </div>
        ) : null}

        {carouselTeams.length > 0 ? (
          <div className="mt-0.5">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/38">
                Teilnehmende Mannschaften
              </p>
              {teamsDisplay != null ? (
                <span className="shrink-0 rounded-full border border-[rgba(255,71,71,0.42)] bg-[rgba(255,71,71,0.1)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[rgba(255,150,150,0.95)] shadow-[0_0_14px_rgba(255,71,71,0.22)]">
                  {teamsDisplay} Teams
                </span>
              ) : null}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {!loadingExtras && topMatch ? (
          <div className="mt-1.5">
            <p className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">
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

        {!loadingExtras ? (
          <div className="mt-1.5">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={`/app/events/${event.id}`}
          className={`${dsPrimaryCtaClass()} mt-2 mb-[max(0.75rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Zum Turniercenter
        </Link>
      </div>
    </article>
  );
}
