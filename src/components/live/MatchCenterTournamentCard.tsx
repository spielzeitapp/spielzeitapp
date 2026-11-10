import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  tournamentPhaseDisplayLabel,
} from '../../lib/matchCenterTournamentVisuals';
import { tournamentPrepareCtaLabel } from '../../lib/tournamentDayOrchestrator';
import { eventNotesTitle, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';
import { ParticipantLogoChip } from './ParticipantLogoChip';
import { useMatchClubBranding } from '../../hooks/useMatchClubBranding';
import { TournamentCompactCard } from '../tournament/TournamentCompactCard';
import { TournamentFirstMatchPreview } from './TournamentMatchCenterPoster';

type LiveDayMode = 'upcoming' | 'active' | 'next_own_match' | 'awaiting_next_round' | 'completed';

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
  liveDayMode?: LiveDayMode;
  nextOwnSlot?: TournamentMatchSlotView | null;
  isFan?: boolean;
  planSyncBusy?: boolean;
  onRefreshPlan?: () => void;
};

export function MatchCenterTournamentCard({
  event,
  ourTeamName,
  now,
  teamCount,
  participants,
  slots,
  loadingExtras = false,
  liveDayMode = 'upcoming',
  nextOwnSlot = null,
  isFan = true,
  planSyncBusy = false,
  onRefreshPlan,
}: Props) {
  const title =
    safeText(
      eventNotesTitle(event.notes) ?? safeOptionalText(event.opponent) ?? 'Turnier',
    ) || 'Turnier';
  const premium = isRudolfSteurerGedenkturnier(title);
  const club = useMatchClubBranding(event.team_season_id);
  const isTournamentDay =
    liveDayMode === 'active' ||
    liveDayMode === 'next_own_match' ||
    liveDayMode === 'awaiting_next_round';

  const countdown = useMemo(
    () => computeMatchCenterCountdown(event.starts_at, now),
    [event.starts_at, now],
  );

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
  const firstMatch = pickTournamentFirstMatch(slots);
  const placementLabel = nextOwnSlot
    ? tournamentPhaseDisplayLabel(nextOwnSlot.phase, nextOwnSlot.group_label)
    : null;
  const isPlacementNext =
    Boolean(placementLabel) &&
    /platz|finale|halb|viertel|ko/i.test(placementLabel ?? '') &&
    placementLabel !== 'Gruppenspiel' &&
    placementLabel !== 'Turnierspiel';

  const badgeLabel =
    liveDayMode === 'awaiting_next_round'
      ? 'Vorrunde beendet'
      : isTournamentDay
        ? 'Turnier läuft'
        : premium
          ? 'Turnier'
          : 'Nächstes Turnier';

  const nextKickoff = nextOwnSlot ? formatTimeHHmmDe(nextOwnSlot.kickoff_at) : null;
  const nextOpponent = nextOwnSlot ? safeText(nextOwnSlot.opponent_name) || 'Gegner' : null;
  const nextPitch = nextOwnSlot ? safeOptionalText(nextOwnSlot.pitch) : null;
  const ourName = safeText(ourTeamName) || 'Unser Team';
  const prepareHref = nextOwnSlot?.match_id
    ? `/app/matches/${nextOwnSlot.match_id}/prepare`
    : `/app/events/${event.id}`;
  const prepareLabel = nextOwnSlot
    ? tournamentPrepareCtaLabel(nextOwnSlot, 1)
    : 'Nächstes Spiel vorbereiten';
  const tournamentHref = `/app/events/${event.id}`;

  const showPreparePrimary = liveDayMode === 'next_own_match' && !isFan && Boolean(nextOwnSlot?.match_id);
  const primaryCtaLabel = showPreparePrimary ? prepareLabel : 'Turnier öffnen';
  const primaryCtaTo = showPreparePrimary ? prepareHref : tournamentHref;

  return (
    <article style={club.style} className="relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet">
      <TournamentCompactCard
        title={title}
        startsAt={event.starts_at}
        meetingAt={event.meeting_at}
        location={event.location ?? event.address}
        badgeLabel={badgeLabel}
        hideCountdown
      />

      <div className="relative bg-[#060608] px-3 pb-2 pt-0.5 sm:px-4 sm:pb-2">
        {liveDayMode === 'awaiting_next_round' ? (
          <div className="mt-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-200/90">
              Vorrunde beendet
            </p>
            <p className="mt-1 text-sm font-semibold text-white">Warte auf nächste Runde</p>
            <p className="mt-1 text-[12px] leading-snug text-white/65">
              Der Turnierplan wird automatisch aktualisiert.
            </p>
          </div>
        ) : null}

        {liveDayMode === 'next_own_match' && nextOwnSlot ? (
          <div className="mt-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] sz-club-accent-text">
              {isPlacementNext ? placementLabel : 'Nächstes Spiel'}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              {ourName}
              <span className="mx-1.5 font-medium text-white/45">vs</span>
              {nextOpponent}
            </p>
            <p className="mt-1 text-[12px] text-white/70">
              {[nextKickoff ? `${nextKickoff} Uhr` : null, nextPitch].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : null}

        {liveDayMode === 'active' && !nextOwnSlot ? (
          <div className="mt-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] sz-club-accent-text">
              Turnier läuft
            </p>
            <p className="mt-1 text-[12px] leading-snug text-white/65">
              Zwischen den Spielen — öffne das Turniercenter für Tabelle und Spielplan.
            </p>
          </div>
        ) : null}

        {liveDayMode === 'upcoming' && countdown ? (
          <MatchCenterCountdown
            parts={countdown}
            variant="heroCompact"
            showHeader
            headerLabel="Countdown bis Turnierstart"
          />
        ) : null}

        {carouselTeams.length > 0 && liveDayMode === 'upcoming' ? (
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

        {!loadingExtras && liveDayMode === 'upcoming' ? (
          <div className="mt-1">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={primaryCtaTo}
          className={`${dsPrimaryCtaClass()} mt-1.5 mb-1 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          {primaryCtaLabel}
        </Link>

        {showPreparePrimary ? (
          <Link
            to={tournamentHref}
            className={`${dsSecondaryCtaClass()} mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl px-4 text-[13px] font-semibold`}
          >
            Turnier öffnen
          </Link>
        ) : null}

        {liveDayMode === 'awaiting_next_round' && !isFan && onRefreshPlan ? (
          <button
            type="button"
            disabled={planSyncBusy}
            onClick={onRefreshPlan}
            className={`${dsSecondaryCtaClass()} mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl px-4 text-[13px] font-semibold disabled:opacity-60`}
          >
            {planSyncBusy ? 'Wird aktualisiert …' : 'Jetzt aktualisieren'}
          </button>
        ) : liveDayMode === 'awaiting_next_round' || liveDayMode === 'active' ? (
          <div className="mb-[max(0.5rem,env(safe-area-inset-bottom,0px))]" />
        ) : null}
      </div>
    </article>
  );
}
