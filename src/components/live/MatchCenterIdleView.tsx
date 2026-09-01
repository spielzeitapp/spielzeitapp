import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../auth/useSession';
import { useEvents } from '../../hooks/useEvents';
import {
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  computeTournamentHeroSummary,
  isAwaitingNextTournamentRound,
  isOwnPlayableTournamentSlot,
  ourTournamentScheduleSlots,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { fetchTournamentCompletion } from '../../lib/tournamentCompletion';
import {
  fetchActiveTournamentLiveContext,
  type ActiveTournamentLiveContext,
} from '../../lib/matchCenterTournamentLive';
import {
  mapTournamentParticipants,
  type MatchCenterParticipant,
  type TournamentParticipantRow,
} from '../../lib/matchCenterTournamentVisuals';
import {
  pickActiveTournamentDayEvent,
  pickNextSportingEvent,
} from '../../lib/matchCenterUtils';
import { resolveTeamSeasonLabelParts } from '../../lib/seasonLifecycle';
import { syncOfficialTournamentPlan } from '../../lib/tournamentPlanSync';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { LivePageHeader, LivePremiumShell, LiveScheduleCtaLink } from './LivePremiumShell';
import { PremiumEmptyState } from '../../ui';
import { MatchCenterNextMatchCard } from './MatchCenterNextMatchCard';
import { MatchCenterTournamentCard } from './MatchCenterTournamentCard';
import { MatchCenterActiveTournamentLiveCard } from './MatchCenterActiveTournamentLiveCard';
import { subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';
import { pickNextOpenTournamentSlot } from '../../lib/tournamentDayOrchestrator';

type Props = {
  isFan: boolean;
  /** Von LivePage: laufendes Turnierspiel direkt auflösen (statt Auto-Liveticker). */
  prioritizedLiveMatchId?: string | null;
};

export function MatchCenterIdleView({ isFan, prioritizedLiveMatchId = null }: Props) {
  const { selectedTeamSeasonId: teamSeasonId, selectedTeamSeason } = useSession();
  const { events, loading: eventsLoading } = useEvents(teamSeasonId);
  const teamName = useMemo(() => {
    if (!selectedTeamSeason) return 'Unser Team';
    return (
      resolveTeamSeasonLabelParts({
        displayName: selectedTeamSeason.display_name,
        ageGroup: selectedTeamSeason.age_group,
        teamName: selectedTeamSeason.team?.name,
        seasonName: selectedTeamSeason.season?.name,
        status: selectedTeamSeason.status,
      }).teamLine || 'Unser Team'
    );
  }, [selectedTeamSeason]);

  const [now, setNow] = useState(() => new Date());
  const [participants, setParticipants] = useState<MatchCenterParticipant[]>([]);
  const [slots, setSlots] = useState<TournamentMatchSlotView[]>([]);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [tournamentExtrasLoading, setTournamentExtrasLoading] = useState(false);
  const [activeLiveContext, setActiveLiveContext] = useState<ActiveTournamentLiveContext | null>(
    null,
  );
  const [activeLiveLoading, setActiveLiveLoading] = useState(false);
  const [planSyncBusy, setPlanSyncBusy] = useState(false);
  const [tournamentExtrasKey, setTournamentExtrasKey] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 8_000);
    const unsub = subscribeLiveMatchStateChanged(() => {
      setNow(new Date());
    });
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, []);

  const activeTournamentDay = useMemo(
    () => (eventsLoading || activeLiveContext ? null : pickActiveTournamentDayEvent(events, now)),
    [events, eventsLoading, activeLiveContext, now],
  );

  const nextSporting = useMemo(() => {
    if (eventsLoading || activeLiveContext || activeTournamentDay) return null;
    return pickNextSportingEvent(events, now);
  }, [events, eventsLoading, activeLiveContext, activeTournamentDay, now]);

  const nextMatch = nextSporting?.kind === 'match' ? nextSporting : null;
  const nextTournament = nextSporting?.kind === 'tournament' ? nextSporting : null;
  const featuredTournament = activeTournamentDay ?? nextTournament;

  useEffect(() => {
    if (!teamSeasonId || eventsLoading) {
      setActiveLiveContext(null);
      setActiveLiveLoading(false);
      return;
    }

    let cancelled = false;
    setActiveLiveLoading(true);

    void fetchActiveTournamentLiveContext({
      teamSeasonId,
      events,
      now,
      matchIdHint: prioritizedLiveMatchId,
    })
      .then((ctx) => {
        if (!cancelled) {
          setActiveLiveContext(ctx);
          setActiveLiveLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveLiveContext(null);
          setActiveLiveLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, events, eventsLoading, now, prioritizedLiveMatchId]);

  useEffect(() => {
    if (!featuredTournament) {
      setParticipants([]);
      setSlots([]);
      setTeamCount(null);
      setMatchCount(null);
      setTournamentCompleted(false);
      setTournamentExtrasLoading(false);
      return;
    }

    let cancelled = false;
    setTournamentExtrasLoading(true);

    void (async () => {
      const [participantsRes, slotsRes, completionRes] = await Promise.all([
        fetchTournamentParticipants(featuredTournament.id),
        fetchTournamentMatchSlots(featuredTournament.id),
        fetchTournamentCompletion(featuredTournament.id),
      ]);
      if (cancelled) return;

      const participantRows = (participantsRes.data ?? []) as TournamentParticipantRow[];
      const loadedSlots = slotsRes.data ?? [];
      const summary = computeTournamentHeroSummary(participantRows, loadedSlots);
      const completion = completionRes.data;

      setParticipants(mapTournamentParticipants(participantRows));
      setSlots(loadedSlots);
      setTeamCount(summary.teamCount > 0 ? summary.teamCount : null);
      setMatchCount(summary.matchCount > 0 ? summary.matchCount : null);
      setTournamentCompleted(Boolean(completion.completedAt));
      setTournamentExtrasLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setParticipants([]);
        setSlots([]);
        setTeamCount(null);
        setMatchCount(null);
        setTournamentCompleted(false);
        setTournamentExtrasLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [featuredTournament?.id, tournamentExtrasKey]);

  const handleRefreshPlan = () => {
    if (!featuredTournament || !teamSeasonId || isFan || planSyncBusy) return;
    const planUrl = safeText(featuredTournament.official_tournament_url);
    if (!planUrl) return;

    setPlanSyncBusy(true);
    void (async () => {
      try {
        const participantNames = participants.map((p) => p.name).filter(Boolean);
        await syncOfficialTournamentPlan({
          tournamentEventId: featuredTournament.id,
          teamSeasonId,
          tournamentDayIso: featuredTournament.starts_at,
          location: safeOptionalText(featuredTournament.location),
          officialUrl: planUrl,
          existingTeamNames: participantNames,
          existingSlots: slots,
          force: true,
        });
        setTournamentExtrasKey((k) => k + 1);
      } finally {
        setPlanSyncBusy(false);
      }
    })();
  };

  const ownSlots = useMemo(() => ourTournamentScheduleSlots(slots), [slots]);
  const awaitingNext = useMemo(
    () =>
      Boolean(activeTournamentDay) &&
      !tournamentCompleted &&
      isAwaitingNextTournamentRound({ ownSlots, allSlots: slots }),
    [activeTournamentDay, tournamentCompleted, ownSlots, slots],
  );
  const nextOwnSlot = useMemo(() => {
    if (!activeTournamentDay || tournamentCompleted || awaitingNext) return null;
    return pickNextOpenTournamentSlot(ownSlots.filter(isOwnPlayableTournamentSlot));
  }, [activeTournamentDay, tournamentCompleted, awaitingNext, ownSlots]);

  const liveDayMode = activeTournamentDay
    ? awaitingNext
      ? 'awaiting_next_round'
      : nextOwnSlot
        ? 'next_own_match'
        : tournamentCompleted
          ? 'completed'
          : 'active'
    : 'upcoming';

  const subtitle = isFan
    ? 'Sobald dein Team live spielt, erscheint der Liveticker hier.'
    : 'Sobald ein Spiel auf LIVE steht, erscheint der Liveticker hier.';

  if (eventsLoading || activeLiveLoading) {
    return (
      <LivePremiumShell centerContent matchCenter>
        <p className="text-sm text-white/60">Lade Match Center…</p>
      </LivePremiumShell>
    );
  }

  if (activeLiveContext) {
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader title="Match Center" subtitle="Live · Turnierspiel" />
        <MatchCenterActiveTournamentLiveCard context={activeLiveContext} ourTeamName={teamName} />
      </LivePremiumShell>
    );
  }

  if (featuredTournament && !tournamentCompleted) {
    const headerSubtitle =
      liveDayMode === 'awaiting_next_round'
        ? 'Vorrunde beendet — warte auf nächstes Spiel'
        : liveDayMode === 'next_own_match'
          ? 'Turnier läuft — nächstes Spiel'
          : activeTournamentDay
            ? 'Turnier läuft'
            : 'Nächstes Turnier';
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader title="Match Center" subtitle={headerSubtitle} />
        <MatchCenterTournamentCard
          event={featuredTournament}
          ourTeamName={teamName}
          now={now}
          teamCount={teamCount}
          matchCount={matchCount}
          participants={participants}
          slots={slots}
          tournamentCompleted={tournamentCompleted}
          loadingExtras={tournamentExtrasLoading}
          liveDayMode={liveDayMode}
          nextOwnSlot={nextOwnSlot}
          isFan={isFan}
          planSyncBusy={planSyncBusy}
          onRefreshPlan={
            !isFan && liveDayMode === 'awaiting_next_round' ? handleRefreshPlan : undefined
          }
        />
      </LivePremiumShell>
    );
  }

  if (nextMatch) {
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader title="Match Center" subtitle="Nächstes Spiel — Countdown bis Anpfiff" />
        <MatchCenterNextMatchCard event={nextMatch} ourTeamName={teamName} now={now} />
      </LivePremiumShell>
    );
  }

  return (
    <LivePremiumShell matchCenter>
      <LivePageHeader title="Match Center" subtitle={subtitle} />
      <PremiumEmptyState
        variant="subtle"
        title={
          isFan
            ? 'Aktuell läuft kein Live-Spiel für dein Team.'
            : 'Aktuell kein Livespiel.'
        }
        description={
          isFan
            ? 'Schau im Spielplan nach dem nächsten Termin oder komm später wieder.'
            : 'Starte ein Spiel im Spielplan oder warte, bis ein Match auf LIVE gesetzt wird.'
        }
        className="py-8"
      >
        <LiveScheduleCtaLink />
      </PremiumEmptyState>
    </LivePremiumShell>
  );
}
