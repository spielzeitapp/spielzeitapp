import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FileText, Radio, Shirt } from 'lucide-react';
import { useInternalBasePath } from '../../demo/demoPaths';
import { publicTeamTournamentPath } from '../../lib/publicTeamTournament';
import type { EventRow } from '../../hooks/useEvents';
import {
  isOwnPlayableTournamentSlot,
  ourTournamentScheduleSlots,
  tournamentSlotScoreDisplay,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import {
  computeMatchCenterCountdown,
  isRudolfSteurerGedenkturnier,
  pickTournamentMatchInProgress,
  resolveMatchCenterTournamentGroup,
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
import { TournamentClubLogo } from '../tournament/TournamentClubLogo';
import { TournamentFirstMatchPreview } from './TournamentMatchCenterPoster';

type LiveDayMode = 'upcoming' | 'active' | 'next_own_match' | 'awaiting_next_round' | 'completed';

const liveMatchViews = [
  { view: 'overview', label: 'Übersicht', Icon: FileText },
  { view: 'formation', label: 'Aufstellung', Icon: Shirt },
  { view: 'ticker', label: 'Liveticker', Icon: Radio },
  { view: 'stats', label: 'Statistik', Icon: BarChart3 },
] as const;

function TournamentMatchupCard({
  slot,
  title,
  status,
  score,
  ourTeamName,
  logoByName,
  action,
}: {
  slot: TournamentMatchSlotView;
  title: string;
  status: 'Live' | 'Jetzt laut Spielplan' | null;
  score?: string | null;
  ourTeamName: string;
  logoByName: ReadonlyMap<string, string | null>;
  action?: { to: string; label: string };
}) {
  const home = safeText(slot.home_team) || ourTeamName;
  const away = safeText(slot.away_team) || safeText(slot.opponent_name) || 'Gegner';
  const kickoff = formatTimeHHmmDe(slot.kickoff_at);

  return (
    <section aria-label={status ? `${title} · ${status}` : title} className="mt-2 mb-3 rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgb(var(--match-primary)),#0a0a0e_70%)] px-3 py-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold">{title}</p>
        {status ? (
          <p className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status === 'Live' ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/85'}`}>
            {status}
          </p>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
        {[home, away].map((name, index) => (
          <div key={index} className={`flex min-w-0 flex-col items-center gap-2 text-center ${index === 0 ? 'col-start-1' : 'col-start-3'} row-start-1`}>
            <TournamentClubLogo name={name} logoUrl={logoByName.get(name.toLowerCase())} size="lg" />
            <p className="text-[13px] font-semibold leading-tight [overflow-wrap:anywhere]">{name}</p>
          </div>
        ))}
        <p className={`col-start-2 row-start-1 self-start pt-3 text-center font-extrabold tabular-nums ${score ? 'text-[32px]' : 'text-lg text-white/55'}`}>
          {score ?? 'VS'}
        </p>
      </div>
      <p className="mt-3 text-center text-xs text-white/65">
        {[kickoff && `${kickoff} Uhr`, slot.pitch].filter(Boolean).join(' · ')}
      </p>
      {action ? (
        <Link to={action.to} className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10">
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

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
  const basePath = useInternalBasePath();
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

  const hasTournamentStarted = now.getTime() >= Date.parse(event.starts_at);
  const showStartCountdown = !hasTournamentStarted;
  const countdown = computeMatchCenterCountdown(
    showStartCountdown ? event.starts_at : nextOwnSlot?.kickoff_at,
    now,
    { roundUpMinutes: showStartCountdown },
  );
  const liveDaySlots = isTournamentDay && hasTournamentStarted
    ? slots.filter((slot) => slot.tournament_event_id === event.id)
    : [];
  const group = resolveMatchCenterTournamentGroup(liveDaySlots, ourTournamentScheduleSlots(liveDaySlots));
  const currentMatch = pickTournamentMatchInProgress(group.slots, now);
  const currentSlot = currentMatch?.slot;
  const currentMatchId = currentSlot?.match_id;
  const hasOfficialLiveScore = currentSlot?.official_home_goals != null && currentSlot.official_away_goals != null;
  const currentScore = currentSlot && currentMatch?.confirmedLive && (hasOfficialLiveScore || currentSlot.result_source === 'spielzeitapp')
    ? tournamentSlotScoreDisplay(currentSlot)
    : null;

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
  const firstMatch = pickTournamentFirstMatch(slots.filter(isOwnPlayableTournamentSlot).filter(slot => (slot.match_status ?? '').toLowerCase() !== 'finished'));
  const placementLabel = nextOwnSlot
    ? tournamentPhaseDisplayLabel(nextOwnSlot.phase, nextOwnSlot.group_label)
    : null;
  const isPlacementNext =
    Boolean(placementLabel) &&
    /platz|finale|halb|viertel|ko/i.test(placementLabel ?? '') &&
    placementLabel !== 'Gruppenspiel' &&
    placementLabel !== 'Turnierspiel';

  const ourName = safeText(ourTeamName) || 'Unser Team';
  const nextMatchToShow = liveDayMode === 'next_own_match' && !currentMatch ? nextOwnSlot : null;
  const prepareHref = nextOwnSlot?.match_id
    ? `/app/matches/${nextOwnSlot.match_id}/prepare`
    : `/app/events/${event.id}`;
  const prepareLabel = nextOwnSlot
    ? tournamentPrepareCtaLabel(nextOwnSlot, 1)
    : 'Nächstes Spiel vorbereiten';
  const tournamentHref = publicTeamTournamentPath(event.id);

  const prepareAction = liveDayMode === 'next_own_match' && !isFan && nextOwnSlot?.match_id
    ? { to: prepareHref, label: prepareLabel }
    : undefined;

  return (
    <article style={club.style} className="relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet">
      {!hasTournamentStarted ? (
        <TournamentCompactCard
          title={title}
          startsAt={event.starts_at}
          meetingAt={event.meeting_at}
          location={event.location ?? event.address}
          badgeLabel={premium ? 'Turnier' : 'Nächstes Turnier'}
          hideCountdown
        />
      ) : null}

      <div className="relative bg-[#060608] px-3 pb-2 pt-0.5 sm:px-4 sm:pb-2">
        {currentMatch ? (
          <TournamentMatchupCard
            slot={currentMatch.slot}
            title={group.label ?? tournamentPhaseDisplayLabel(currentMatch.slot.phase, currentMatch.slot.group_label)}
            status={currentMatch.confirmedLive ? 'Live' : 'Jetzt laut Spielplan'}
            score={currentScore}
            ourTeamName={ourName}
            logoByName={logoByName}
            action={currentSlot?.id === nextOwnSlot?.id ? prepareAction : undefined}
          />
        ) : null}

        {currentMatchId ? (
          <nav aria-label="Laufendes Spiel" className="mb-3 grid grid-cols-2 gap-2">
            {liveMatchViews.map(({ view, label, Icon }) => (
              <Link
                key={view}
                to={`${tournamentHref}?spiel=${encodeURIComponent(currentMatchId)}&ansicht=${view}`}
                state={{ returnTo: `${basePath}/live` }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Icon className="h-4 w-4 shrink-0 sz-club-accent-text" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        ) : null}

        {liveDayMode === 'awaiting_next_round' && !currentMatch ? (
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

        {nextMatchToShow ? (
          <TournamentMatchupCard
            slot={nextMatchToShow}
            title={isPlacementNext && placementLabel ? placementLabel : 'Unser nächstes Spiel'}
            status={null}
            ourTeamName={ourName}
            logoByName={logoByName}
            action={prepareAction}
          />
        ) : null}

        {(showStartCountdown || nextMatchToShow) && countdown ? (
          <MatchCenterCountdown
            parts={countdown}
            variant="heroCompact"
            showHeader
            headerLabel={showStartCountdown ? 'Countdown bis zum Turnierstart' : 'Countdown bis zu unserem nächsten Spiel'}
          />
        ) : null}

        {carouselTeams.length > 0 && !hasTournamentStarted && liveDayMode === 'upcoming' ? (
          <div className="mt-1">
            <div className="mb-0 flex items-center justify-between gap-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/38">
                Teilnehmende Mannschaften
              </p>
              {teamsDisplay != null ? (
                <span className="shrink-0 rounded-full border border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.06)] px-1 py-px text-[11px] font-bold uppercase tracking-[0.05em] text-[rgba(255,150,150,0.9)] shadow-[0_0_8px_rgba(255,71,71,0.12)]">
                  {teamsDisplay} Teams
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-5 pb-4">
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

        {!loadingExtras && !hasTournamentStarted && liveDayMode === 'upcoming' ? (
          <div className="mt-1">
            <TournamentFirstMatchPreview
              slot={firstMatch}
              ourTeamName={ourTeamName}
              participantLogoByName={logoByName}
            />
          </div>
        ) : null}

        <Link
          to={tournamentHref}
          className={`${dsPrimaryCtaClass()} mt-1.5 mb-1 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
        >
          Turnierseite ansehen
        </Link>

        {!isFan && !hasTournamentStarted && !prepareAction ? (
          <Link to={`/app/events/${event.id}`} className={`${dsSecondaryCtaClass()} mb-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 text-[13px] font-semibold`}>
            Zur Turniervorbereitung
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
