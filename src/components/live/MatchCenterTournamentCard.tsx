import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Trophy } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import {
  computeMatchCenterCountdown,
  isRudolfSteurerGedenkturnier,
  RUDOLF_STEUrer_DEMO_PARTICIPANTS,
} from '../../lib/matchCenterUtils';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { eventNotesTitle } from '../schedule/scheduleEventViewUtils';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';
import { ParticipantLogoChip } from './ParticipantLogoChip';

const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

type Props = {
  event: EventRow;
  now: Date;
  teamCount: number | null;
  matchCount: number | null;
  participantNames: string[];
  loadingExtras?: boolean;
};

function StatMini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/42">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

export function MatchCenterTournamentCard({
  event,
  now,
  teamCount,
  matchCount,
  participantNames,
  loadingExtras = false,
}: Props) {
  const title = (eventNotesTitle(event.notes) ?? event.opponent ?? 'Turnier').trim() || 'Turnier';
  const premium = isRudolfSteurerGedenkturnier(title);

  const countdown = useMemo(
    () => computeMatchCenterCountdown(event.starts_at, now),
    [event.starts_at, now],
  );
  const dateParts = formatHeroDateParts(event.starts_at);
  const kickoff = formatTimeHHmmDe(event.starts_at);
  const parsedLocation = splitCombinedLocation(event.location);
  const place = formatFullLocation(parsedLocation.place, parsedLocation.address || (event.address ?? ''));

  const carouselTeams = useMemo(() => {
    if (participantNames.length > 0) return participantNames;
    if (premium) return [...RUDOLF_STEUrer_DEMO_PARTICIPANTS];
    return [];
  }, [participantNames, premium]);

  const teamsDisplay = teamCount ?? (carouselTeams.length > 0 ? carouselTeams.length : null);
  const matchesDisplay = matchCount;

  if (premium) {
    return (
      <article className="relative overflow-hidden rounded-[20px] border border-[rgba(220,38,38,0.35)] shadow-[0_0_36px_rgba(220,38,38,0.14),0_16px_48px_rgba(0,0,0,0.58)]">
        <div className="relative bg-black px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100">
              <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2} aria-hidden />
              Turnier
            </span>
          </div>
          <h2 className="mt-2 text-[19px] font-bold leading-tight tracking-tight text-white sm:text-[22px]">
            {title}
          </h2>
        </div>

        <div className="relative min-w-0 overflow-hidden">
          <img
            src={stadiumBgUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-[92%_12%] opacity-[0.2] brightness-[0.62] saturate-[0.85]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,8,10,0.78)_0%,rgba(12,8,10,0.9)_48%,rgba(6,4,6,0.96)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_88%_68%_at_100%_-8%,rgba(255,248,235,0.18)_0%,rgba(122,29,42,0.22)_28%,transparent_68%)]"
            aria-hidden
          />

          <div className="relative px-3 py-3.5 sm:px-4 sm:py-4">
            <div className="flex items-center gap-2 text-[12px] text-white/72">
              <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg border border-red-500/28 bg-black/35 px-2 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-300/80">
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

            {countdown ? (
              <div className="mt-3.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                  Countdown
                </p>
                <MatchCenterCountdown parts={countdown} />
              </div>
            ) : null}

            {(teamsDisplay != null || matchesDisplay != null) && !loadingExtras ? (
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                {teamsDisplay != null ? <StatMini label="Teams" value={teamsDisplay} /> : null}
                {matchesDisplay != null ? <StatMini label="Spiele" value={matchesDisplay} /> : null}
              </div>
            ) : null}

            {carouselTeams.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                  Teilnehmende Mannschaften
                </p>
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pl-1 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {carouselTeams.map((name) => (
                    <ParticipantLogoChip key={name} teamName={name} compact />
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              to={`/app/events/${event.id}`}
              className={`${dsPrimaryCtaClass()} mt-4 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
            >
              Zum Turniercenter
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-[20px] border border-[rgba(220,38,38,0.28)] shadow-[0_0_28px_rgba(220,38,38,0.1),0_14px_40px_rgba(0,0,0,0.5)]">
      <div className="relative bg-black px-3 py-2.5 sm:px-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-950/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100">
          <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2} aria-hidden />
          Nächstes Turnier
        </span>
        <h2 className="mt-2 text-[18px] font-bold leading-tight text-white">{title}</h2>
      </div>

      <div className="relative bg-gradient-to-br from-[rgba(18,12,14,0.98)] to-[rgba(8,6,8,0.98)] px-3 py-3.5 sm:px-4 sm:py-4">
        <div className="flex items-center gap-2 text-[12px] text-white/72">
          <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg border border-red-500/22 bg-black/35 px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-red-300/75">
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

        {countdown ? (
          <div className="mt-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              Countdown
            </p>
            <MatchCenterCountdown parts={countdown} />
          </div>
        ) : null}

        {(teamsDisplay != null || matchesDisplay != null) && !loadingExtras ? (
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            {teamsDisplay != null ? <StatMini label="Teams" value={teamsDisplay} /> : null}
            {matchesDisplay != null ? <StatMini label="Spiele" value={matchesDisplay} /> : null}
          </div>
        ) : null}

        <Link
          to={`/app/events/${event.id}`}
          className={`${dsPrimaryCtaClass()} mt-4 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Zum Turniercenter
        </Link>
      </div>
    </article>
  );
}
