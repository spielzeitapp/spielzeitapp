import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileInput, Plus, Trash2 } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import { Modal } from '../../app/ui/Modal';
import { dsScheduleGlassButtonClass, DS_LIST_GAP } from '../../lib/premiumDesignSystem';
import {
  addTournamentParticipant,
  computeTournamentHeroSummary,
  computeTournamentTeamBalance,
  createTournamentMatchSlot,
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  importTournamentParticipantsBulk,
  ownPlayableTournamentSlots,
  ourTournamentScheduleSlots,
  countOwnTournamentMatchesByPhase,
  isAwaitingFurtherTournamentPhase,
  parseTournamentParticipantImportLines,
  removeTournamentMatchSlot,
  removeTournamentParticipant,
  TOURNAMENT_DEFAULT_PLANNED_MINUTES,
  tournamentImportSuccessMessage,
  type TournamentMatchSlotView,
  type TournamentParticipant,
} from '../../lib/tournamentPlan';
import { canCompleteTournament, computeTournamentFinalSummary, shouldShowTournamentPremiumFinalCard } from '../../lib/tournamentFinalSummary';
import { usePlayers } from '../../hooks/usePlayers';
import { useDemoMode } from '../../demo/DemoContext';
import {
  completeTournamentEvent,
  fetchTournamentCompletion,
  type TournamentCompletionState,
} from '../../lib/tournamentCompletion';
import { fetchTournamentCombinedGoalScorers } from '../../lib/tournamentManualGoalScorers';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import {
  computeAllLiveTournamentGroupStandings,
  computeCombinedTournamentGroupStandings,
  computeTournamentGroupStandings,
  pickPrimaryTournamentGroupStandings,
  resolveTournamentStandingsBundle,
  type TournamentGroupStandings,
  type TournamentStandingsBundle,
} from '../../lib/tournamentGroupStandings';
import {
  analyzeTournamentUrl,
  fetchTournamentImportRecognition,
  type TournamentPlanImportRawMatch,
} from '../../lib/tournamentPlanImport';
import {
  formatTournamentPlanSyncAge,
  getOfficialTournamentSyncedAt,
  isOfficialTournamentSyncActive,
  markOfficialTournamentSynced,
  syncOfficialTournamentPlan,
} from '../../lib/tournamentPlanSync';
import { subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';
import { openOfficialTournamentPlanUrl } from '../../lib/tournamentOfficialPlanUrl';
import {
  buildTournamentCompletionFeedCaption,
  buildTournamentCompletionFeedPayload,
  buildTournamentCompletionReportText,
  publishTournamentCompletionFeedPost,
} from '../../lib/tournamentCompletionFeed';
import { formatCompletionPlacementLine } from '../../lib/tournamentCompletionDisplay';
import { TournamentCompleteModal, type TournamentCompleteFormValues } from './TournamentCompleteModal';
import { TournamentPremiumFinalCard } from './TournamentPremiumFinalCard';
import { TournamentReportModal } from './TournamentReportModal';
import { TournamentOfficialPlanCard } from './TournamentOfficialPlanCard';
import { TournamentTeamAliasesCard } from './TournamentTeamAliasesCard';
import { TournamentCenterTabBar } from './TournamentCenterTabBar';
import { TournamentCompactCard } from './TournamentCompactCard';
import { TournamentFeaturedMatchCard } from './TournamentFeaturedMatchCard';
import { TournamentAssistantCard } from './TournamentAssistantCard';
import { TournamentInfoCard } from './TournamentInfoCard';
import { TournamentLastResultsCard } from './TournamentLastResultsCard';
import { TournamentCollapsibleSection } from './TournamentCollapsibleSection';
import { TournamentPreparationPanel } from './TournamentPreparationPanel';
import { TournamentSquadPanel } from './TournamentSquadPanel';
import { TournamentMatchSlotCard } from './TournamentMatchSlotCard';
import { TournamentOverviewBalanceCard } from './TournamentOverviewBalanceCard';
import { TournamentScorersOverviewCard } from './TournamentScorersOverviewCard';
import { TournamentGroupPreviewCard } from './TournamentGroupPreviewCard';
import { TournamentTableTab } from './TournamentTableTab';
import { TournamentTeamsTab } from './TournamentTeamsTab';
import {
  formatTournamentDayDate,
  formatTournamentLocationDisplay,
  groupTournamentSlotsBySection,
} from './tournamentCenterUtils';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { safeText } from '../../lib/safeText';
import { resolveTournamentCenterPhase, type TournamentCenterPhase } from '../../lib/tournamentCenterPhase';
import type { TournamentAttendanceSummary } from '../../lib/tournamentPreparationFlow';
import {
  TournamentTrainerAdminAccordion,
  TournamentTrainerAdminSection,
} from './TournamentTrainerAdminAccordion';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL, TC_STACK_GAP, type TournamentCenterTabId } from './tournamentCenterStyles';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  tournamentTitle: string;
  ourTeamName: string;
  location: string | null;
  /** Source of Truth: `events.meeting_at` */
  meetingAt?: string | null;
  officialTournamentUrl: string | null;
  tournamentCoverUrl?: string | null;
  tournamentNotes?: string | null;
  canManage: boolean;
  userId?: string | null;
  trainerActions?: React.ReactNode;
  trainerAttendanceSection?: React.ReactNode;
  trainerFeedSection?: React.ReactNode;
  attendanceSummary?: TournamentAttendanceSummary;
  quickActions?: React.ReactNode;
  onOpenMatchPreparation: (matchId: string) => void;
  onOfficialTournamentUrlUpdated: (url: string | null) => void;
  onTournamentCompleted?: () => void;
};

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

const textareaClass = `${inputClass} min-h-[180px] resize-y leading-snug`;

const addButtonClass = `relative z-[2] inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold touch-manipulation sm:w-auto sm:shrink-0 ${dsScheduleGlassButtonClass()}`;

export const TournamentDetailSections: React.FC<Props> = ({
  tournamentEventId,
  teamSeasonId,
  tournamentDayIso,
  tournamentTitle,
  ourTeamName,
  location,
  meetingAt = null,
  officialTournamentUrl,
  tournamentCoverUrl = null,
  tournamentNotes = null,
  canManage,
  userId = null,
  trainerActions = null,
  trainerAttendanceSection = null,
  trainerFeedSection = null,
  attendanceSummary = { playerCount: 0, yesCount: 0, noCount: 0, openCount: 0 },
  quickActions = null,
  onOpenMatchPreparation,
  onOfficialTournamentUrlUpdated,
  onTournamentCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<TournamentCenterTabId>('overview');
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [slots, setSlots] = useState<TournamentMatchSlotView[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantGroup, setParticipantGroup] = useState('');
  const [participantBusy, setParticipantBusy] = useState(false);
  const [participantModalError, setParticipantModalError] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importGroup, setImportGroup] = useState('');
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aliasesReloadToken, setAliasesReloadToken] = useState(0);
  const [planWorkflowRequest, setPlanWorkflowRequest] = useState<{
    action: 'import' | 'qr' | 'link';
    key: number;
  } | null>(null);

  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchKickoff, setMatchKickoff] = useState('10:00');
  const [matchMinutes, setMatchMinutes] = useState(String(TOURNAMENT_DEFAULT_PLANNED_MINUTES));
  const [matchPitch, setMatchPitch] = useState('');
  const [matchGroup, setMatchGroup] = useState('');
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchModalError, setMatchModalError] = useState<string | null>(null);
  const [groupStandings, setGroupStandings] = useState<TournamentGroupStandings | null>(null);
  const [groupStandingsLoading, setGroupStandingsLoading] = useState(false);
  const [recognizedTeamNames, setRecognizedTeamNames] = useState<string[]>([]);
  const [planImportContext, setPlanImportContext] = useState<{
    rawMatches: TournamentPlanImportRawMatch[];
    teamCount: number;
    ourTeamNames: string[];
  } | null>(null);
  const [goalScorers, setGoalScorers] = useState<TournamentGoalScorer[]>([]);
  const [goalScorersLoading, setGoalScorersLoading] = useState(false);
  const [hasMatchEventGoals, setHasMatchEventGoals] = useState(false);
  const [completion, setCompletion] = useState<TournamentCompletionState>({
    completedAt: null,
    completedBy: null,
    finalPlacement: null,
    finalTeamsCount: null,
    finalLabel: null,
  });
  const [completingTournament, setCompletingTournament] = useState(false);
  const [orchestratorReportOpen, setOrchestratorReportOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [syncAgeLabel, setSyncAgeLabel] = useState<string | null>(null);
  const [planSyncBusy, setPlanSyncBusy] = useState(false);
  const [planSyncStatus, setPlanSyncStatus] = useState<string | null>(null);
  const [gamesFilter, setGamesFilter] = useState<'ours' | 'all'>(() => (canManage ? 'ours' : 'all'));
  const finishedOwnCountRef = React.useRef<number | null>(null);
  const groupStageDoneSyncRef = React.useRef(false);
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const { players: dbPlayers, loading: playersLoadingLive } = usePlayers(isDemo ? null : teamSeasonId);
  const players = isDemo && demo ? demo.players : dbPlayers;
  const playersLoading = isDemo ? false : playersLoadingLive;

  const reload = useCallback(async () => {
    setLoading(true);
    const [pRes, mRes] = await Promise.all([
      fetchTournamentParticipants(tournamentEventId),
      fetchTournamentMatchSlots(tournamentEventId),
    ]);
    const err = pRes.error ?? mRes.error;
    setListError(err);
    setParticipants(pRes.data);
    setSlots(mRes.data);
    setLoading(false);
  }, [tournamentEventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const existingTeamNames = useMemo(() => participants.map((p) => p.team_name), [participants]);
  const ownSlots = useMemo(() => ownPlayableTournamentSlots(slots), [slots]);
  const ourScheduleSlots = useMemo(() => ourTournamentScheduleSlots(slots), [slots]);
  const ownMatchCounts = useMemo(() => countOwnTournamentMatchesByPhase(slots), [slots]);
  const awaitingFurtherPhase = useMemo(
    () =>
      isAwaitingFurtherTournamentPhase({
        ownSlots,
        allSlots: slots,
      }) && !completion.completedAt,
    [ownSlots, slots, completion.completedAt],
  );
  const filteredGamesSlots = useMemo(
    () => (gamesFilter === 'ours' ? ourScheduleSlots : slots),
    [gamesFilter, ourScheduleSlots, slots],
  );

  const scrollToTeamAliases = useCallback(() => {
    setActiveTab('admin');
    setAliasesReloadToken((t) => t + 1);
    requestAnimationFrame(() => {
      document.getElementById('tournament-team-aliases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const importPreviewCount = useMemo(
    () => parseTournamentParticipantImportLines(importText, existingTeamNames).length,
    [importText, existingTeamNames],
  );

  const opponentSuggestions = useMemo(
    () => participants.map((p) => p.team_name).filter((n, i, arr) => arr.indexOf(n) === i),
    [participants],
  );

  const heroSummary = useMemo(
    () => computeTournamentHeroSummary(participants, slots),
    [participants, slots],
  );

  const teamBalance = useMemo(() => computeTournamentTeamBalance(ownSlots), [ownSlots]);

  const finalSummary = useMemo(
    () =>
      computeTournamentFinalSummary({
        balance: teamBalance,
        rawMatches: planImportContext?.rawMatches,
        slots,
        groupStandings,
        ourTeamNames: planImportContext?.ourTeamNames ?? [],
        teamCount: planImportContext?.teamCount ?? null,
      }),
    [teamBalance, planImportContext, slots, groupStandings],
  );

  const reloadGoalScorers = useCallback(async () => {
    const matchIds = ownSlots.map((slot) => slot.match_id).filter((id): id is string => Boolean(id));
    if (matchIds.length === 0) {
      setGoalScorers([]);
      setHasMatchEventGoals(false);
      setGoalScorersLoading(false);
      return;
    }

    setGoalScorersLoading(true);
    const result = await fetchTournamentCombinedGoalScorers({
      matchIds,
      eventId: tournamentEventId,
    });
    setGoalScorers(result.data);
    setHasMatchEventGoals(result.hasMatchEventGoals);
    setGoalScorersLoading(false);
  }, [ownSlots, tournamentEventId]);

  useEffect(() => {
    void reloadGoalScorers();
  }, [reloadGoalScorers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchTournamentCompletion(tournamentEventId);
      if (!cancelled) setCompletion(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentEventId]);

  const handleCompleteTournament = () => {
    if (!userId) return;
    setCompleteModalOpen(true);
  };

  const handleConfirmCompleteTournament = async (values: TournamentCompleteFormValues) => {
    if (!userId) return;

    setCompletingTournament(true);
    const placementLine =
      values.placementRank != null && values.teamsCount != null
        ? formatCompletionPlacementLine({
            completedAt: null,
            completedBy: null,
            finalPlacement: values.placementRank,
            finalTeamsCount: values.teamsCount,
            finalLabel: values.label,
          })
        : values.label?.trim() || 'Turnier beendet';

    const result = await completeTournamentEvent({
      eventId: tournamentEventId,
      userId,
      placement: values.placementRank,
      teamsCount: values.teamsCount,
      label: values.label,
    });
    setCompletingTournament(false);

    if (result.error) {
      setListError(result.error);
      return;
    }

    if (result.data) {
      setCompletion(result.data);
      setCompleteModalOpen(false);
      setToastMessage('Turnier abgeschlossen.');
      onTournamentCompleted?.();

      if (values.publishFeed) {
        const payload = buildTournamentCompletionFeedPayload({
          eventId: tournamentEventId,
          tournamentTitle,
          placementLine,
          teamsCount: values.teamsCount,
          balance: teamBalance,
          goalScorers,
          slots,
          completionComment: values.comment,
        });
        const caption = buildTournamentCompletionFeedCaption({
          tournamentTitle,
          placementLine,
          balance: teamBalance,
          topScorer: goalScorers[0] ?? null,
          completionComment: values.comment,
        });
        const feedResult = await publishTournamentCompletionFeedPost({
          eventId: tournamentEventId,
          teamSeasonId,
          userId,
          caption,
          payload,
        });
        if (!feedResult.ok && feedResult.reason !== 'already_posted') {
          setListError(
            typeof feedResult.reason === 'string'
              ? `Turnier abgeschlossen, Feed-Beitrag fehlgeschlagen: ${feedResult.reason}`
              : 'Turnier abgeschlossen, Feed-Beitrag fehlgeschlagen.',
          );
        }
      }
    }
  };

  useEffect(() => {
    const planUrl = safeText(officialTournamentUrl);
    if (!planUrl || !teamSeasonId || participants.length === 0) {
      setGroupStandings(null);
      setPlanImportContext(null);
      setGroupStandingsLoading(false);
      return;
    }

    let cancelled = false;
    setGroupStandingsLoading(true);

    void (async () => {
      try {
        const recognition = await fetchTournamentImportRecognition(teamSeasonId);
        if (cancelled) return;

        const analysisResult = await analyzeTournamentUrl(planUrl);
        if (cancelled) return;

        if (!analysisResult.ok) {
          setGroupStandings(null);
          setPlanImportContext(null);
          return;
        }

        const ourTeamNames = recognition.knownNames;
        const { rawMatches, teamCount } = analysisResult.analysis;

        setPlanImportContext({ rawMatches, teamCount, ourTeamNames });
        setGroupStandings(
          computeTournamentGroupStandings({
            participants,
            rawMatches,
            ourTeamNames,
          }),
        );
      } finally {
        if (!cancelled) setGroupStandingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [officialTournamentUrl, teamSeasonId, participants]);

  const slotsRef = React.useRef(slots);
  slotsRef.current = slots;
  const existingTeamNamesRef = React.useRef(existingTeamNames);
  existingTeamNamesRef.current = existingTeamNames;
  const ownSlotsRef = React.useRef(ownSlots);
  ownSlotsRef.current = ownSlots;

  const runForcedPlanSync = useCallback(
    async (opts?: { reason?: 'post_match' | 'manual' | 'group_done' | 'broadcast' }) => {
      const planUrl = safeText(officialTournamentUrl);
      if (!planUrl || completion.completedAt) return;
      const reason = opts?.reason ?? 'manual';
      setPlanSyncBusy(true);
      setPlanSyncStatus(
        reason === 'group_done'
          ? 'Nächste Runde wird aktualisiert …'
          : 'Turnierplan wird aktualisiert …',
      );
      try {
        const result = await syncOfficialTournamentPlan({
          tournamentEventId,
          teamSeasonId,
          tournamentDayIso,
          location,
          officialUrl: planUrl,
          existingTeamNames: existingTeamNamesRef.current,
          existingSlots: slotsRef.current,
          force: true,
        });
        setSyncAgeLabel(formatTournamentPlanSyncAge(getOfficialTournamentSyncedAt(tournamentEventId)));
        if (result.ok) {
          setPlanSyncStatus('Turnierplan aktualisiert');
          if (result.changed || reason === 'post_match' || reason === 'group_done' || reason === 'broadcast') {
            await reload();
          }
        } else {
          setPlanSyncStatus('Aktualisierung fehlgeschlagen — lokal behalten');
        }
      } catch {
        setPlanSyncStatus('Aktualisierung fehlgeschlagen — lokal behalten');
      } finally {
        setPlanSyncBusy(false);
        window.setTimeout(() => {
          setPlanSyncStatus(null);
          setSyncAgeLabel(formatTournamentPlanSyncAge(getOfficialTournamentSyncedAt(tournamentEventId)));
        }, 3500);
      }
    },
    [
      officialTournamentUrl,
      completion.completedAt,
      tournamentEventId,
      teamSeasonId,
      tournamentDayIso,
      location,
      reload,
    ],
  );

  useEffect(() => {
    if (!canManage || loading) return;
    const planUrl = safeText(officialTournamentUrl);
    if (!planUrl) return;
    const hasUnfinishedOwnMatch = ownSlots.some(
      (slot) => (slot.match_status ?? '').toLowerCase() !== 'finished',
    );
    if (
      !isOfficialTournamentSyncActive({
        tournamentArchived: Boolean(completion.completedAt),
        tournamentDayIso,
        hasUnfinishedOwnMatch,
        awaitingNextRound: awaitingFurtherPhase,
      })
    ) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      const result = await syncOfficialTournamentPlan({
        tournamentEventId,
        teamSeasonId,
        tournamentDayIso,
        location,
        officialUrl: planUrl,
        existingTeamNames: existingTeamNamesRef.current,
        existingSlots: slotsRef.current,
      });
      if (cancelled) return;
      setSyncAgeLabel(formatTournamentPlanSyncAge(getOfficialTournamentSyncedAt(tournamentEventId)));
      if (!result.ok || result.skipped || !result.changed) return;
      await reload();
    };

    void run();
    const interval = window.setInterval(() => void run(), 60_000);
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      void run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [
    canManage,
    loading,
    officialTournamentUrl,
    tournamentDayIso,
    tournamentEventId,
    teamSeasonId,
    location,
    reload,
    completion.completedAt,
    ownSlots,
    awaitingFurtherPhase,
  ]);

  useEffect(() => {
    const finished = ownSlots.filter((slot) => (slot.match_status ?? '').toLowerCase() === 'finished').length;
    const previous = finishedOwnCountRef.current;
    finishedOwnCountRef.current = finished;
    if (previous === null || finished <= previous) return;
    if (!canManage || completion.completedAt) return;
    const planUrl = safeText(officialTournamentUrl);
    if (!planUrl) return;
    void runForcedPlanSync({ reason: 'post_match' });
  }, [
    ownSlots,
    canManage,
    completion.completedAt,
    officialTournamentUrl,
    runForcedPlanSync,
  ]);

  /** Extra Sync wenn alle eigenen Gruppenspiele fertig sind (KO prüfen). */
  useEffect(() => {
    if (!canManage || completion.completedAt) return;
    if (!awaitingFurtherPhase) {
      groupStageDoneSyncRef.current = false;
      return;
    }
    if (groupStageDoneSyncRef.current) return;
    if (!safeText(officialTournamentUrl)) return;
    groupStageDoneSyncRef.current = true;
    void runForcedPlanSync({ reason: 'group_done' });
  }, [
    awaitingFurtherPhase,
    canManage,
    completion.completedAt,
    officialTournamentUrl,
    runForcedPlanSync,
  ]);

  useEffect(() => {
    if (!canManage || completion.completedAt) return;
    const ownMatchIds = new Set(
      ownSlotsRef.current
        .map((slot) => String(slot.match_id ?? '').trim())
        .filter(Boolean),
    );
    return subscribeLiveMatchStateChanged((detail) => {
      if (detail.status !== 'finished') return;
      if (!ownMatchIds.has(detail.matchId)) return;
      void (async () => {
        await reload();
        await runForcedPlanSync({ reason: 'broadcast' });
      })();
    });
  }, [canManage, completion.completedAt, reload, runForcedPlanSync, ownSlots]);

  useEffect(() => {
    const tick = () => {
      if (planSyncBusy) return;
      setSyncAgeLabel(formatTournamentPlanSyncAge(getOfficialTournamentSyncedAt(tournamentEventId)));
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [tournamentEventId, planSyncBusy]);

  useEffect(() => {
    if (!teamSeasonId) {
      setRecognizedTeamNames([]);
      return;
    }
    let cancelled = false;
    void fetchTournamentImportRecognition(teamSeasonId).then((recognition) => {
      if (!cancelled && recognition.knownNames.length > 0) {
        setRecognizedTeamNames(recognition.knownNames);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  const ourTeamNames = useMemo(() => {
    const fromPlan = planImportContext?.ourTeamNames ?? [];
    if (fromPlan.length > 0) return fromPlan;
    if (recognizedTeamNames.length > 0) return recognizedTeamNames;
    return ourTeamName ? [ourTeamName] : [];
  }, [planImportContext, recognizedTeamNames, ourTeamName]);

  const liveGroupStandings = useMemo(
    () =>
      computeAllLiveTournamentGroupStandings({
        participants,
        slots: ownSlots,
        ourTeamNames,
      }),
    [participants, ownSlots, ourTeamNames],
  );

  const combinedStandings = useMemo(
    () =>
      computeCombinedTournamentGroupStandings({
        participants,
        slots,
        ourTeamNames,
      }),
    [participants, slots, ourTeamNames],
  );

  const standingsBundle = useMemo((): TournamentStandingsBundle => {
    if (combinedStandings.length > 0) {
      return {
        source: 'imported',
        groups: combinedStandings,
        primaryGroup: pickPrimaryTournamentGroupStandings(combinedStandings),
      };
    }
    return resolveTournamentStandingsBundle({
      imported: groupStandings,
      liveGroups: liveGroupStandings,
    });
  }, [combinedStandings, groupStandings, liveGroupStandings]);

  const standingsLoading = groupStandingsLoading && standingsBundle.source !== 'live';

  const showFullStandingsTable = useCallback(() => {
    setActiveTab('table');
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const nextMatchId = heroSummary.nextMatch?.id ?? null;

  const handleImportPlanFromOverview = useCallback(() => {
    const planUrl = safeText(officialTournamentUrl);
    setPlanWorkflowRequest({
      action: planUrl ? 'import' : 'qr',
      key: Date.now(),
    });
  }, [officialTournamentUrl]);

  const scrollToAttendance = useCallback(() => {
    setActiveTab('admin');
    requestAnimationFrame(() => {
      document.getElementById('tournament-attendance-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const scrollToSquad = useCallback(() => {
    setActiveTab('admin');
    requestAnimationFrame(() => {
      document.getElementById('tournament-squad-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const openTeamsForParticipants = useCallback(() => {
    setActiveTab('teams');
    setParticipantModalError(null);
    setParticipantModalOpen(true);
  }, []);

  const tournamentPhase = useMemo(
    (): TournamentCenterPhase =>
      resolveTournamentCenterPhase({
        tournamentDayIso,
        slots,
        completion,
      }),
    [tournamentDayIso, slots, completion],
  );

  useEffect(() => {
    if (tournamentPhase !== 'day' || completion.completedAt) return undefined;

    const hasLive = slots.some((s) => (s.match_status ?? '').toLowerCase() === 'live');
    const intervalMs = hasLive ? 8_000 : 20_000;
    const interval = window.setInterval(() => void reload(), intervalMs);

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    window.addEventListener('focus', refreshOnVisible);
    document.addEventListener('visibilitychange', refreshOnVisible);

    const onLiveBroadcast = () => {
      void reload();
    };
    window.addEventListener('spielzeit:live-match-state-changed', onLiveBroadcast);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnVisible);
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('spielzeit:live-match-state-changed', onLiveBroadcast);
    };
  }, [tournamentPhase, completion.completedAt, slots, reload]);

  const orchestratorReportText = useMemo(() => {
    const placementLine = completion.completedAt
      ? formatCompletionPlacementLine(completion)
      : finalSummary?.finalPlacementLabel
        ? formatCompletionPlacementLine({
            completedAt: null,
            completedBy: null,
            finalPlacement: finalSummary.finalPlacementRank,
            finalTeamsCount: finalSummary.finalPlacementTotal,
            finalLabel: finalSummary.finalPlacementLabel,
          })
        : 'Turnier beendet';

    return buildTournamentCompletionReportText({
      tournamentTitle,
      summary: finalSummary,
      balance: teamBalance,
      placementLine,
      goalScorers,
    });
  }, [tournamentTitle, finalSummary, teamBalance, goalScorers, completion]);

  const orchestratorCanCreateReport = Boolean(orchestratorReportText.trim()) || teamBalance.played > 0;
  const orchestratorCanComplete =
    canCompleteTournament(teamBalance) &&
    !completion.completedAt &&
    canManage &&
    !awaitingFurtherPhase;

  const showPremiumFinalCard = shouldShowTournamentPremiumFinalCard(teamBalance, completion);
  const showPremiumAboveTabs = Boolean(completion.completedAt) && showPremiumFinalCard;

  const showOrchestratorOverview = useCallback(() => {
    setActiveTab('overview');
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const overviewSectionOrder = useMemo((): string[] => {
    if (completion.completedAt) {
      return ['results', 'scorers', 'table', 'info'];
    }
    if (tournamentPhase === 'day') {
      return ['results', 'info', 'balance'];
    }
    if (tournamentPhase === 'after') {
      return ['results', 'scorers', 'table', 'info', 'balance'];
    }
    return ['info'];
  }, [tournamentPhase, completion.completedAt]);

  const showAssistant =
    canManage &&
    !completion.completedAt &&
    (tournamentPhase === 'before' || (tournamentPhase === 'day' && ownSlots.length === 0));
  const showFeatured =
    !completion.completedAt &&
    (!canManage || tournamentPhase === 'day' || tournamentPhase === 'after');
  const showCompactAboveTabs = tournamentPhase === 'day' && !completion.completedAt;

  const planUrlForFans = safeText(officialTournamentUrl);

  const renderOverviewSection = (key: string) => {
    switch (key) {
      case 'table':
        return (
          <div key={key}>
            <TournamentGroupPreviewCard
              bundle={standingsBundle}
              loading={standingsLoading}
              onShowFullTable={showFullStandingsTable}
            />
          </div>
        );
      case 'balance':
        return <TournamentOverviewBalanceCard key={key} balance={teamBalance} loading={loading} />;
      case 'scorers':
        return (
          <TournamentScorersOverviewCard
            key={key}
            scorers={goalScorers}
            players={players}
            loading={loading || goalScorersLoading}
          />
        );
      case 'results':
        return (
          <TournamentLastResultsCard
            key={key}
            slots={slots}
            loading={loading}
            onOpen={onOpenMatchPreparation}
          />
        );
      case 'placement':
        return null;
      case 'info':
        return (
          <TournamentInfoCard key={key} rows={infoRows} notes={tournamentNotes}>
            {planUrlForFans ? (
              <button
                type="button"
                onClick={() => openOfficialTournamentPlanUrl(planUrlForFans)}
                className="mt-1 inline-flex min-h-[32px] items-center justify-center self-start text-[11px] font-semibold text-white/55 underline-offset-2 hover:text-white/80 hover:underline touch-manipulation"
              >
                Offiziellen Turnierplan öffnen
              </button>
            ) : null}
          </TournamentInfoCard>
        );
      default:
        return null;
    }
  };

  const renderAdminTab = () => {
    if (!canManage) return null;
    const planUrl = safeText(officialTournamentUrl);
    return (
      <div className={`flex flex-col ${TC_STACK_GAP}`}>
        <TournamentPreparationPanel
          tournamentEventId={tournamentEventId}
          slots={ownSlots}
          participantCount={participants.length}
          hasOfficialPlanUrl={Boolean(planUrl)}
          attendance={attendanceSummary}
          loading={loading}
          onImportPlan={handleImportPlanFromOverview}
          onAddMatch={openMatchModal}
          onAddParticipants={openTeamsForParticipants}
          onScrollToAttendance={scrollToAttendance}
          onScrollToSquad={scrollToSquad}
        />
        {trainerAttendanceSection ? (
          <div id="tournament-attendance-section">
            <TournamentCollapsibleSection title="Zu-/Absagen" icon="👥" defaultExpanded>
              {trainerAttendanceSection}
            </TournamentCollapsibleSection>
          </div>
        ) : null}
        <TournamentSquadPanel
          tournamentEventId={tournamentEventId}
          teamSeasonId={teamSeasonId}
          slots={ownSlots}
          loading={loading}
          canManage={canManage}
        />
        <TournamentTrainerAdminAccordion>
          <TournamentTrainerAdminSection title="Offizieller Turnierplan">
            <TournamentOfficialPlanCard
              tournamentEventId={tournamentEventId}
              teamSeasonId={teamSeasonId}
              tournamentDayIso={tournamentDayIso}
              location={location}
              officialTournamentUrl={officialTournamentUrl}
              existingTeamNames={participants.map((p) => p.team_name)}
              existingSlots={slots}
              canManage={canManage}
              tournamentArchived={Boolean(completion.completedAt)}
              embedded
              workflowRequest={planWorkflowRequest}
              onUrlUpdated={onOfficialTournamentUrlUpdated}
              onImportComplete={() => {
                markOfficialTournamentSynced(tournamentEventId);
                void reload();
              }}
              onScrollToAliases={scrollToTeamAliases}
            />
          </TournamentTrainerAdminSection>
          <TournamentTrainerAdminSection title="Turnier-Aliase">
            <div id="tournament-team-aliases">
              <TournamentTeamAliasesCard
                teamSeasonId={teamSeasonId}
                canManage={canManage}
                reloadToken={aliasesReloadToken}
                embedded
              />
            </div>
          </TournamentTrainerAdminSection>
        </TournamentTrainerAdminAccordion>
        {trainerFeedSection ? (
          <TournamentCollapsibleSection title="Feed & Kommunikation" icon="📢" defaultExpanded={false}>
            {trainerFeedSection}
          </TournamentCollapsibleSection>
        ) : null}
        {trainerActions ? (
          <TournamentTrainerAdminAccordion>
            <TournamentTrainerAdminSection title="Bearbeiten / Löschen">{trainerActions}</TournamentTrainerAdminSection>
          </TournamentTrainerAdminAccordion>
        ) : null}
      </div>
    );
  };

  const slotSections = useMemo(
    () => groupTournamentSlotsBySection(filteredGamesSlots),
    [filteredGamesSlots],
  );

  const infoRows = useMemo(() => {
    const beginn = formatTimeHHmmDe(tournamentDayIso);
    const meetupRaw = meetingAt ? formatMeetupTimeOnlyDe(meetingAt) : '';
    const meetupCore = meetupRaw.replace(/\s*Uhr$/i, '').trim();
    const planUrl = safeText(officialTournamentUrl);
    return [
      { label: 'Datum', value: formatTournamentDayDate(tournamentDayIso) },
      { label: 'Treffpunkt', value: meetupCore ? `${meetupCore} Uhr` : '–' },
      { label: 'Beginn', value: beginn ? `${beginn} Uhr` : '' },
      { label: 'Ort', value: formatTournamentLocationDisplay(location) },
      { label: 'Teams', value: participants.length > 0 ? String(participants.length) : '' },
      { label: 'Turnierplan', value: planUrl ? 'Hinterlegt' : 'Nicht hinterlegt' },
    ].filter((row) => row.value.length > 0);
  }, [participants.length, tournamentDayIso, meetingAt, location, officialTournamentUrl]);

  const openParticipantModal = () => {
    setParticipantModalError(null);
    setParticipantModalOpen(true);
  };

  const openImportModal = () => {
    setImportModalError(null);
    setImportModalOpen(true);
  };

  const handleImportParticipants = async () => {
    const names = parseTournamentParticipantImportLines(importText, existingTeamNames);
    if (names.length === 0) {
      setImportModalError('Keine neuen Mannschaften gefunden. Eine Mannschaft pro Zeile eingeben.');
      return;
    }
    setImportBusy(true);
    setImportModalError(null);
    const { imported, error: err } = await importTournamentParticipantsBulk({
      tournamentEventId,
      groupLabel: importGroup || null,
      teamNames: names,
    });
    setImportBusy(false);
    if (err) {
      setImportModalError(err);
      setListError(err);
      return;
    }
    setImportText('');
    setImportGroup('');
    setImportModalOpen(false);
    setToastMessage(tournamentImportSuccessMessage(imported));
    void reload();
  };

  const openMatchModal = () => {
    setMatchModalError(null);
    setMatchModalOpen(true);
  };

  const handleAddParticipant = async () => {
    const name = participantName.trim();
    if (!name) {
      setParticipantModalError('Bitte Mannschaftsname eingeben.');
      return;
    }
    setParticipantBusy(true);
    setParticipantModalError(null);
    const { error: err } = await addTournamentParticipant({
      tournamentEventId,
      teamName: name,
      groupLabel: participantGroup || null,
    });
    setParticipantBusy(false);
    if (err) {
      setParticipantModalError(err);
      setListError(err);
      return;
    }
    setParticipantName('');
    setParticipantGroup('');
    setParticipantModalOpen(false);
    void reload();
  };

  const handleAddMatch = async () => {
    const opponent = matchOpponent.trim();
    if (!opponent) {
      setMatchModalError('Bitte Gegner eingeben.');
      return;
    }
    if (!matchKickoff.trim()) {
      setMatchModalError('Bitte Anstoßzeit eingeben.');
      return;
    }
    setMatchBusy(true);
    setMatchModalError(null);
    const minutes = Number.parseInt(matchMinutes, 10);
    const { error: err } = await createTournamentMatchSlot({
      tournamentEventId,
      teamSeasonId,
      tournamentDayIso,
      location,
      opponentName: opponent,
      kickoffTimeHHmm: matchKickoff,
      plannedMinutes: Number.isFinite(minutes) ? minutes : TOURNAMENT_DEFAULT_PLANNED_MINUTES,
      pitch: matchPitch || null,
      groupLabel: matchGroup || null,
    });
    setMatchBusy(false);
    if (err) {
      setMatchModalError(err);
      setListError(err);
      return;
    }
    setMatchOpponent('');
    setMatchKickoff('10:00');
    setMatchMinutes(String(TOURNAMENT_DEFAULT_PLANNED_MINUTES));
    setMatchPitch('');
    setMatchGroup('');
    setMatchModalOpen(false);
    void reload();
  };

  const handleRemoveParticipant = async (id: string) => {
    const { error: err } = await removeTournamentParticipant(id);
    if (err) setListError(err);
    else void reload();
  };

  const handleRemoveSlot = async (matchId: string) => {
    if (!window.confirm('Turnierspiel und alle zugehörigen Match-Daten wirklich löschen?')) return;
    const { error: err } = await removeTournamentMatchSlot(matchId);
    if (err) setListError(err);
    else void reload();
  };

  return (
    <div className={`flex min-w-0 flex-col overflow-x-hidden ${TC_STACK_GAP}`}>
      {toastMessage ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[1001] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-[rgba(255,71,71,0.28)] bg-[rgba(10,8,8,0.96)] px-4 py-2.5 text-center text-[14px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:top-4 sm:bottom-auto"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      <TournamentCompactCard
        title={tournamentTitle}
        startsAt={tournamentDayIso}
        location={location}
        meetingAt={meetingAt}
        coverUrl={tournamentCoverUrl}
        participantCount={participants.length}
      />

      {quickActions}

      {canManage && (planSyncBusy || planSyncStatus) ? (
        <p className="px-0.5 text-[10px] font-medium text-white/45" role="status" aria-live="polite">
          {planSyncBusy ? planSyncStatus ?? 'Turnierplan wird aktualisiert …' : planSyncStatus}
        </p>
      ) : canManage && syncAgeLabel ? (
        <p className="px-0.5 text-[10px] font-medium text-white/40">{syncAgeLabel}</p>
      ) : null}

      {showFeatured ? (
        <TournamentFeaturedMatchCard
          slots={ownSlots}
          ourTeamName={ourTeamName}
          loading={loading}
          canManage={canManage}
          tournamentArchived={Boolean(completion.completedAt)}
          canCreateReport={orchestratorCanCreateReport}
          canCompleteTournament={orchestratorCanComplete}
          completingTournament={completingTournament}
          awaitingFurtherPhase={awaitingFurtherPhase}
          refreshingPlan={planSyncBusy}
          onOpen={onOpenMatchPreparation}
          onAddMatch={canManage ? openMatchModal : undefined}
          onCreateReport={() => setOrchestratorReportOpen(true)}
          onCompleteTournament={handleCompleteTournament}
          onShowOverview={showOrchestratorOverview}
          onRefreshPlan={() => void runForcedPlanSync({ reason: 'manual' })}
        />
      ) : null}

      {showAssistant ? (
        <TournamentAssistantCard
          tournamentEventId={tournamentEventId}
          slots={ownSlots}
          attendance={attendanceSummary}
          hasOfficialPlanUrl={Boolean(safeText(officialTournamentUrl))}
          loading={loading}
          tournamentArchived={Boolean(completion.completedAt)}
          canCompleteTournament={orchestratorCanComplete}
          canCreateReport={orchestratorCanCreateReport}
          completingTournament={completingTournament}
          awaitingFurtherPhase={awaitingFurtherPhase}
          refreshingPlan={planSyncBusy}
          ownMatchCount={ownSlots.length}
          totalMatchCount={slots.length}
          onOpenAttendance={scrollToAttendance}
          onOpenSquad={scrollToSquad}
          onImportPlan={handleImportPlanFromOverview}
          onAddMatch={openMatchModal}
          onCreateReport={() => setOrchestratorReportOpen(true)}
          onCompleteTournament={handleCompleteTournament}
          onViewStatus={showOrchestratorOverview}
          onRefreshPlan={() => void runForcedPlanSync({ reason: 'manual' })}
          onLineupCopied={() => void reload()}
        />
      ) : null}

      {showPremiumAboveTabs ? (
        <TournamentPremiumFinalCard
          tournamentTitle={tournamentTitle}
          balance={teamBalance}
          completion={completion}
          summary={finalSummary}
          goalScorers={goalScorers}
          goalScorersLoading={goalScorersLoading}
          slots={slots}
          loading={loading}
          canManage={canManage}
        />
      ) : null}

      {showCompactAboveTabs ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
          <TournamentGroupPreviewCard
            bundle={standingsBundle}
            loading={standingsLoading}
            onShowFullTable={showFullStandingsTable}
          />
          <TournamentScorersOverviewCard
            scorers={goalScorers}
            players={players}
            loading={loading || goalScorersLoading}
          />
        </div>
      ) : null}

      <TournamentCenterTabBar activeTab={activeTab} onTabChange={setActiveTab} canManage={canManage} />

      {listError ? (
        <p className="text-[13px] text-red-300/90" role="alert">
          {listError}
        </p>
      ) : null}

      {activeTab === 'overview' ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
          {overviewSectionOrder.map((sectionKey) => renderOverviewSection(sectionKey))}
        </div>
      ) : null}

      {activeTab === 'games' ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-full border border-white/12 bg-white/[0.04] p-0.5"
              role="group"
              aria-label="Spielplan-Filter"
            >
              <button
                type="button"
                className={`min-h-[36px] rounded-full px-3 text-[12px] font-semibold touch-manipulation ${
                  gamesFilter === 'ours'
                    ? 'bg-white/12 text-white'
                    : 'text-white/55 hover:text-white/80'
                }`}
                onClick={() => setGamesFilter('ours')}
              >
                Unsere Spiele
              </button>
              <button
                type="button"
                className={`min-h-[36px] rounded-full px-3 text-[12px] font-semibold touch-manipulation ${
                  gamesFilter === 'all'
                    ? 'bg-white/12 text-white'
                    : 'text-white/55 hover:text-white/80'
                }`}
                onClick={() => setGamesFilter('all')}
              >
                Alle Spiele
              </button>
            </div>
            {canManage && ownMatchCounts.total > 0 ? (
              <p className="text-[11px] text-white/45">
                {ownMatchCounts.knockout > 0
                  ? `${ownMatchCounts.total} eigene Spiele`
                  : `${ownMatchCounts.group} Gruppenspiele`}
              </p>
            ) : null}
          </div>

          {canManage ? (
            <button type="button" className={addButtonClass} onClick={openMatchModal}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Turnierspiel hinzufügen
            </button>
          ) : null}

          {loading ? (
            <section className={TC_CARD}>
              <div className={TC_CARD_INNER}>
                <p className="text-[14px] text-white/55">Lade Turnierplan…</p>
              </div>
            </section>
          ) : filteredGamesSlots.length === 0 ? (
            <section className={TC_CARD}>
              <div className={`${TC_CARD_INNER} text-center py-2`}>
                <p className={TC_SECTION_LABEL}>Spiele</p>
                <p className="mt-2 text-[14px] text-white/55">
                  {gamesFilter === 'ours'
                    ? 'Keine eigenen Turnierspiele gefunden.'
                    : 'Keine Turnierspiele geplant.'}
                </p>
              </div>
            </section>
          ) : (
            slotSections.map((section) => (
              <section key={section.key} className={TC_CARD}>
                <div className={TC_CARD_INNER}>
                  <p className={`${TC_SECTION_LABEL} mb-2.5`}>{section.label}</p>
                  <ul className={`flex flex-col ${DS_LIST_GAP}`}>
                    {section.slots.map((slot) => (
                      <li key={slot.id}>
                        <TournamentMatchSlotCard
                          slot={slot}
                          canManage={canManage}
                          isNextUpcoming={slot.id === nextMatchId && slot.is_own_team !== false}
                          onOpen={() => {
                            if (slot.match_id) onOpenMatchPreparation(slot.match_id);
                          }}
                          onDelete={
                            canManage && slot.match_id && slot.is_own_team !== false
                              ? () => void handleRemoveSlot(slot.match_id as string)
                              : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'table' ? (
        <TournamentTableTab bundle={standingsBundle} loading={standingsLoading} />
      ) : null}

      {activeTab === 'teams' ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
          {canManage ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={addButtonClass} onClick={openParticipantModal}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Team
              </button>
              <button type="button" className={addButtonClass} onClick={openImportModal}>
                <FileInput className="h-3.5 w-3.5" aria-hidden />
                Import
              </button>
            </div>
          ) : null}

          <TournamentTeamsTab participants={participants} loading={loading} />

          {canManage && participants.length > 0 ? (
            <section className={TC_CARD}>
              <div className={TC_CARD_INNER}>
                <p className={`${TC_SECTION_LABEL} mb-2`}>Teams verwalten</p>
                <div className="flex flex-wrap gap-1.5">
                  {participants.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1"
                    >
                      <span className="max-w-[min(100%,12rem)] truncate text-[12px] font-medium text-white/88">
                        {p.team_name}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0.5 text-white/45 hover:text-red-400 touch-manipulation"
                        aria-label={`${p.team_name} entfernen`}
                        onClick={() => void handleRemoveParticipant(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'admin' && canManage ? renderAdminTab() : null}

      <Modal
        isOpen={participantModalOpen}
        onClose={() => !participantBusy && setParticipantModalOpen(false)}
        title="Team hinzufügen"
        footer={
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setParticipantModalOpen(false)} disabled={participantBusy}>
              Abbrechen
            </AppButton>
            <AppButton variant="primary" onClick={() => void handleAddParticipant()} disabled={participantBusy}>
              {participantBusy ? 'Speichern…' : 'Hinzufügen'}
            </AppButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {participantModalError ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {participantModalError}
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Mannschaftsname *</span>
            <input
              className={inputClass}
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="z. B. Austria"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gruppe (optional)</span>
            <input
              className={inputClass}
              value={participantGroup}
              onChange={(e) => setParticipantGroup(e.target.value)}
              placeholder="A oder B"
              autoComplete="off"
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={importModalOpen}
        onClose={() => !importBusy && setImportModalOpen(false)}
        title="Mannschaften importieren"
        footer={
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setImportModalOpen(false)} disabled={importBusy}>
              Abbrechen
            </AppButton>
            <AppButton
              variant="primary"
              onClick={() => void handleImportParticipants()}
              disabled={importBusy || importPreviewCount === 0}
            >
              {importBusy ? 'Importieren…' : `Importieren${importPreviewCount > 0 ? ` (${importPreviewCount})` : ''}`}
            </AppButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {importModalError ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {importModalError}
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gruppe (optional)</span>
            <input
              className={inputClass}
              value={importGroup}
              onChange={(e) => setImportGroup(e.target.value)}
              placeholder="z. B. A"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Eine Mannschaft pro Zeile</span>
            <textarea
              className={textareaClass}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Austria\nHartberg\nVienna\nWilhelmsburg\nRohrbach'}
              rows={8}
              spellCheck={false}
            />
          </label>
          {importPreviewCount > 0 ? (
            <p className="text-[12px] text-purple-200/75">
              {importPreviewCount === 1
                ? '1 Mannschaft wird importiert'
                : `${importPreviewCount} Mannschaften werden importiert`}
              {importGroup.trim() ? ` · Gruppe ${importGroup.trim()}` : ''}
            </p>
          ) : importText.trim() ? (
            <p className="text-[12px] text-white/50">Keine neuen Mannschaften (bereits vorhanden oder leer).</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={matchModalOpen}
        onClose={() => !matchBusy && setMatchModalOpen(false)}
        title="Turnierspiel hinzufügen"
        footer={
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setMatchModalOpen(false)} disabled={matchBusy}>
              Abbrechen
            </AppButton>
            <AppButton variant="primary" onClick={() => void handleAddMatch()} disabled={matchBusy}>
              {matchBusy ? 'Anlegen…' : 'Hinzufügen'}
            </AppButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {matchModalError ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {matchModalError}
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gegner *</span>
            <input
              className={inputClass}
              list="tournament-opponent-suggestions"
              value={matchOpponent}
              onChange={(e) => setMatchOpponent(e.target.value)}
              placeholder="z. B. TSV Hartberg"
              autoComplete="off"
            />
            <datalist id="tournament-opponent-suggestions">
              {opponentSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Anstoßzeit *</span>
            <input
              type="time"
              className={inputClass}
              value={matchKickoff}
              onChange={(e) => setMatchKickoff(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Spieldauer (Min., Standard {TOURNAMENT_DEFAULT_PLANNED_MINUTES})</span>
            <input
              type="number"
              min={1}
              max={120}
              className={inputClass}
              value={matchMinutes}
              onChange={(e) => setMatchMinutes(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Platz (optional)</span>
            <input
              className={inputClass}
              value={matchPitch}
              onChange={(e) => setMatchPitch(e.target.value)}
              placeholder="Platz 2"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gruppe (optional)</span>
            <input
              className={inputClass}
              value={matchGroup}
              onChange={(e) => setMatchGroup(e.target.value)}
              placeholder="A"
              autoComplete="off"
            />
          </label>
        </div>
      </Modal>

      <TournamentReportModal
        isOpen={orchestratorReportOpen}
        reportText={orchestratorReportText}
        onClose={() => setOrchestratorReportOpen(false)}
      />

      <TournamentCompleteModal
        isOpen={completeModalOpen}
        tournamentEventId={tournamentEventId}
        summary={finalSummary}
        participantCount={participants.length}
        planTeamCount={planImportContext?.teamCount ?? null}
        completing={completingTournament}
        onClose={() => setCompleteModalOpen(false)}
        onConfirm={(values) => void handleConfirmCompleteTournament(values)}
      />
    </div>
  );
};
