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
} from '../../lib/matchCenterTournamentVisuals';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { eventNotesTitle, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText, safeText } from '../../lib/safeText';
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

function formatTournamentInfoDate(iso: unknown): string {
  if (!safeText(iso)) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

const HERO_META_ICON = 'h-3 w-3 shrink-0 text-red-400/90';

function HeroMetaLine({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium leading-snug text-white/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
      <Icon className={HERO_META_ICON} strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

export function MatchCenterTournamentCard({
  event,
  ourTeamName,
  now,
  teamCount,
  participants,
  slots,
  loadingExtras = false,
}: Props) {
  const title =
    safeText(
      eventNotesTitle(event.notes) ?? safeOptionalText(event.opponent) ?? 'Turnier',
    ) || 'Turnier';
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
      map.set(safeText(p.name).toLowerCase(), safeOptionalText(p.logoUrl));
    }
    return map;
  }, [carouselTeams]);

  const teamsDisplay = teamCount ?? (carouselTeams.length > 0 ? carouselTeams.length : null);
  const topMatch = pickTournamentTopMatch(slots);
  const firstMatch = pickTournamentFirstMatch(slots);

  return (
    <article className="relative overflow-hidden rounded-[18px] bg-[#060608] shadow-[0_16px_48px_rgba(0,0,0,0.68)] ring-1 ring-white/[0.04]">
      <div className="relative min-h-[9.25rem] w-full overflow-hidden sm:min-h-[10.625rem]">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[84%_48%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0)_24%,rgba(0,0,0,0.04)_50%,rgba(6,4,6,0.35)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[62%] bg-[linear-gradient(to_right,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.28)_55%,transparent_100%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col px-3 pb-2 pt-1.5 sm:px-4">
          <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/35 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/80 backdrop-blur-[2px]">
            <Trophy
              className="h-3 w-3 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>

          <div className="mt-auto max-w-[58%] pb-1 pt-2">
            <div className="space-y-1.5 rounded-lg bg-black/30 px-2 py-1.5 backdrop-blur-[2px]">
              <h2 className="line-clamp-2 text-left text-[16px] font-bold leading-[1.14] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] sm:text-[17px]">
                {title}
              </h2>
              <div className="flex flex-col gap-0.5">
                <HeroMetaLine icon={CalendarDays}>{infoDate}</HeroMetaLine>
                <HeroMetaLine icon={Clock}>{kickoff} Uhr</HeroMetaLine>
                {place ? <HeroMetaLine icon={MapPin}>{place}</HeroMetaLine> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-[#060608] px-3 pb-2 pt-0.5 sm:px-4 sm:pb-2">
        {countdown ? (
          <MatchCenterCountdown
            parts={countdown}
            variant="heroCompact"
            showHeader
            headerLabel="Countdown bis Turnierstart"
          />
        ) : null}

        {carouselTeams.length > 0 ? (
          <div className="mt-1">
            <div className="mb-0 flex items-center justify-between gap-1.5">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/38">
                Teilnehmende Mannschaften
              </p>
              {teamsDisplay != null ? (
                <span className="shrink-0 rounded-full border border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.06)] px-1 py-px text-[6px] font-bold uppercase tracking-[0.05em] text-[rgba(255,150,150,0.9)] shadow-[0_0_8px_rgba(255,71,71,0.12)]">
                  {teamsDisplay} Teams
                </span>
              ) : null}
            </div>
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <div className="mt-1">
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
          <div className="mt-1">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={`/app/events/${event.id}`}
          className={`${dsPrimaryCtaClass()} mt-1.5 mb-[max(0.75rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Zum Turniercenter
        </Link>
      </div>
    </article>
  );
}
