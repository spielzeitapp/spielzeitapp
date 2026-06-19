import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Trophy } from 'lucide-react';
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

const INFO_ICON_CLASS = 'h-3 w-3 shrink-0 text-red-400/80';

function InfoItem({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <Icon className={INFO_ICON_CLASS} strokeWidth={2.25} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-white/62">
      {teamsDisplay != null ? (
        <span className="whitespace-nowrap">
          <span aria-hidden>👥 </span>
          {teamsDisplay} Teams
        </span>
      ) : null}
      {matchesDisplay != null ? (
        <>
          {teamsDisplay != null ? (
            <span className="text-white/20" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="whitespace-nowrap">
            <span aria-hidden>⚽ </span>
            {matchesDisplay} Spiele
          </span>
        </>
      ) : null}
      {(teamsDisplay != null || matchesDisplay != null) ? (
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
    <article className="relative overflow-hidden rounded-[18px] bg-[#060608] shadow-[0_16px_48px_rgba(0,0,0,0.68)] ring-1 ring-white/[0.04]">
      {/* Hero — kompakt, Titel-Overlay */}
      <div className="relative min-h-[11.75rem] w-full overflow-hidden sm:min-h-[13.5rem]">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_30%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.04)_30%,rgba(0,0,0,0.22)_62%,rgba(6,4,6,0.78)_100%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col justify-between px-3 pb-2 pt-1.5 sm:px-4 sm:pb-2.5">
          <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.07] bg-black/30 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/72 backdrop-blur-[2px]">
            <Trophy
              className="h-3 w-3 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>

          <div className="mt-auto pt-1">
            <h2 className="text-[17px] font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)] sm:text-[19px]">
              {title}
            </h2>
          </div>
        </div>
      </div>

      <div className="relative bg-[#060608] px-3 pb-2 pt-1 sm:px-4 sm:pb-2.5">
        {/* Info-Leiste — Lucide, flach */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-white/58">
          <InfoItem icon={CalendarDays}>{infoDate}</InfoItem>
          <span className="text-white/18" aria-hidden>
            ·
          </span>
          <InfoItem icon={Clock}>{kickoff} Uhr</InfoItem>
          {place ? (
            <>
              <span className="text-white/18" aria-hidden>
                ·
              </span>
              <InfoItem icon={MapPin}>{place}</InfoItem>
            </>
          ) : null}
        </div>

        {countdown ? (
          <div className="mt-1.5">
            <MatchCenterCountdown parts={countdown} variant="heroCompact" />
          </div>
        ) : null}

        {!loadingExtras && (teamsDisplay != null || matchesDisplay != null || winnerDisplay) ? (
          <div className="mt-1.5">
            <TournamentCompactStats
              teamsDisplay={teamsDisplay}
              matchesDisplay={matchesDisplay}
              winnerDisplay={winnerDisplay}
            />
          </div>
        ) : null}

        {carouselTeams.length > 0 ? (
          <div className="mt-2">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">
              Teilnehmende Mannschaften
            </p>
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5 pl-0.5 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <div className="mt-2">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">
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
          <div className="mt-2">
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
