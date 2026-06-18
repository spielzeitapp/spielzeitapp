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
    <article className="relative overflow-hidden rounded-[20px] border border-[rgba(220,38,38,0.38)] shadow-[0_0_40px_rgba(220,38,38,0.16),0_18px_52px_rgba(0,0,0,0.6)]">
      <div className="relative bg-black px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100">
            <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2} aria-hidden />
            {premium ? 'Turnier' : 'Nächstes Turnier'}
          </span>
        </div>
        <h2 className="mt-2 text-[19px] font-bold leading-tight tracking-tight text-white sm:text-[22px]">
          {title}
        </h2>
      </div>

      <div className="relative min-w-0 overflow-hidden">
        <img
          src={coverUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-[92%_12%] opacity-[0.22] brightness-[0.58] saturate-[0.88]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,6,8,0.72)_0%,rgba(10,6,8,0.88)_42%,rgba(4,4,6,0.96)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(255,248,235,0.14)_0%,rgba(122,29,42,0.18)_32%,transparent_68%)]"
          aria-hidden
        />

        <div className="relative px-3 py-3.5 sm:px-4 sm:py-4">
          {countdown ? (
            <div className="relative -mx-0.5 mb-4 rounded-[18px] border border-red-500/28 bg-[rgba(4,4,6,0.55)] px-2 py-3 shadow-[0_0_40px_rgba(220,38,38,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px] sm:px-3 sm:py-3.5">
              <p className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-red-300/80">
                Countdown bis Beginn
              </p>
              <MatchCenterCountdown parts={countdown} variant="hero" />
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-[12px] text-white/72">
            <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg border border-red-500/28 bg-black/40 px-2 py-1">
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

          {!loadingExtras && (teamsDisplay != null || matchesDisplay != null || winnerDisplay) ? (
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
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
            <div className="mt-4">
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
            <div className="mt-4">
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
            <div className="mt-4">
              <TournamentFirstMatchPreview
                slot={firstMatch}
                ourTeamName={ourTeamName}
                participantLogoByName={logoByName}
              />
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
