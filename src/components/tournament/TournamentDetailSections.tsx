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
  parseTournamentParticipantImportLines,
  removeTournamentMatchSlot,
  removeTournamentParticipant,
  TOURNAMENT_DEFAULT_PLANNED_MINUTES,
  tournamentImportSuccessMessage,
  type TournamentMatchSlotView,
  type TournamentParticipant,
} from '../../lib/tournamentPlan';
import { computeTournamentFinalSummary } from '../../lib/tournamentFinalSummary';
import { usePlayers } from '../../hooks/usePlayers';
import {
  completeTournamentEvent,
  fetchTournamentCompletion,
  type TournamentCompletionState,
} from '../../lib/tournamentCompletion';
import { fetchTournamentCombinedGoalScorers } from '../../lib/tournamentManualGoalScorers';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import { computeTournamentGroupStandings, type TournamentGroupStandings } from '../../lib/tournamentGroupStandings';
import {
  analyzeTournamentUrl,
  fetchTournamentImportRecognition,
  type TournamentPlanImportRawMatch,
} from '../../lib/tournamentPlanImport';
import { TournamentFinalSummaryCard } from './TournamentFinalSummaryCard';
import { TournamentOfficialPlanCard } from './TournamentOfficialPlanCard';
import { TournamentTeamAliasesCard } from './TournamentTeamAliasesCard';
import { TournamentCenterTabBar } from './TournamentCenterTabBar';
import { TournamentFeaturedMatchCard } from './TournamentFeaturedMatchCard';
import { TournamentInfoCard } from './TournamentInfoCard';
import { TournamentLastResultsCard } from './TournamentLastResultsCard';
import { TournamentMatchSlotCard } from './TournamentMatchSlotCard';
import { TournamentOverviewBalanceCard } from './TournamentOverviewBalanceCard';
import { TournamentScorersOverviewCard } from './TournamentScorersOverviewCard';
import { TournamentTableTab } from './TournamentTableTab';
import { TournamentTeamsTab } from './TournamentTeamsTab';
import {
  formatTournamentDayDate,
  formatTournamentLocationDisplay,
  groupTournamentSlotsBySection,
} from './tournamentCenterUtils';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeText } from '../../lib/safeText';
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
  location: string | null;
  officialTournamentUrl: string | null;
  tournamentNotes?: string | null;
  canManage: boolean;
  userId?: string | null;
  trainerActions?: React.ReactNode;
  trainerAttendanceSection?: React.ReactNode;
  trainerFeedSection?: React.ReactNode;
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
  location,
  officialTournamentUrl,
  tournamentNotes = null,
  canManage,
  userId = null,
  trainerActions = null,
  trainerAttendanceSection = null,
  trainerFeedSection = null,
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
  const { players, loading: playersLoading } = usePlayers(teamSeasonId);

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

  const scrollToTeamAliases = useCallback(() => {
    setActiveTab('overview');
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

  const teamBalance = useMemo(() => computeTournamentTeamBalance(slots), [slots]);

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
    const matchIds = slots.map((slot) => slot.match_id).filter(Boolean);
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
  }, [slots, tournamentEventId]);

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

  const handleCompleteTournament = async () => {
    if (!finalSummary || !userId) return;
    if (!window.confirm('Turnier jetzt abschließen? Import bleibt möglich.')) return;

    setCompletingTournament(true);
    const result = await completeTournamentEvent({
      eventId: tournamentEventId,
      userId,
      summary: finalSummary,
    });
    setCompletingTournament(false);

    if (result.error) {
      setListError(result.error);
      return;
    }
    if (result.data) {
      setCompletion(result.data);
      setToastMessage('Turnier abgeschlossen.');
      onTournamentCompleted?.();
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

  const nextMatchId = heroSummary.nextMatch?.id ?? null;

  const handleImportPlanFromOverview = useCallback(() => {
    const planUrl = safeText(officialTournamentUrl);
    setPlanWorkflowRequest({
      action: planUrl ? 'import' : 'qr',
      key: Date.now(),
    });
  }, [officialTournamentUrl]);

  const slotSections = useMemo(() => groupTournamentSlotsBySection(slots), [slots]);

  const infoRows = useMemo(() => {
    const beginn = formatTimeHHmmDe(tournamentDayIso);
    const planUrl = safeText(officialTournamentUrl);
    return [
      { label: 'Datum', value: formatTournamentDayDate(tournamentDayIso) },
      { label: 'Beginn', value: beginn ? `${beginn} Uhr` : '' },
      { label: 'Ort', value: formatTournamentLocationDisplay(location) },
      { label: 'Teams', value: participants.length > 0 ? String(participants.length) : '' },
      { label: 'Turnierplan', value: planUrl ? 'Hinterlegt' : 'Nicht hinterlegt' },
    ].filter((row) => row.value.length > 0);
  }, [participants.length, tournamentDayIso, location, officialTournamentUrl]);

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

      <TournamentCenterTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {listError ? (
        <p className="text-[13px] text-red-300/90" role="alert">
          {listError}
        </p>
      ) : null}

      {activeTab === 'overview' ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
          <TournamentFeaturedMatchCard
            slots={slots}
            loading={loading}
            canManage={canManage}
            hasOfficialPlanUrl={Boolean(safeText(officialTournamentUrl))}
            onOpen={onOpenMatchPreparation}
            onAddMatch={canManage ? openMatchModal : undefined}
            onImportPlan={canManage ? handleImportPlanFromOverview : undefined}
          />
          <TournamentOverviewBalanceCard balance={teamBalance} loading={loading} />
          <TournamentScorersOverviewCard
            scorers={goalScorers}
            players={players}
            loading={loading || goalScorersLoading}
          />
          <TournamentLastResultsCard
            slots={slots}
            loading={loading}
            onOpen={onOpenMatchPreparation}
          />
          <TournamentFinalSummaryCard
            tournamentEventId={tournamentEventId}
            tournamentTitle={tournamentTitle}
            balance={teamBalance}
            summary={finalSummary}
            completion={completion}
            goalScorers={goalScorers}
            goalScorersLoading={goalScorersLoading}
            hasMatchEventGoals={hasMatchEventGoals}
            canManage={canManage}
            userId={userId}
            players={players}
            playersLoading={playersLoading}
            loading={loading || groupStandingsLoading}
            onManualScorersSaved={() => void reloadGoalScorers()}
            onCompleteTournament={() => void handleCompleteTournament()}
            completingTournament={completingTournament}
          />
          <TournamentInfoCard rows={infoRows} notes={tournamentNotes} />

          {canManage ? (
            <TournamentTrainerAdminAccordion>
              {trainerAttendanceSection ? (
                <TournamentTrainerAdminSection title="Zu-/Absagen">
                  {trainerAttendanceSection}
                </TournamentTrainerAdminSection>
              ) : null}

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
                  onImportComplete={() => void reload()}
                  onScrollToAliases={scrollToTeamAliases}
                />
              </TournamentTrainerAdminSection>

              <TournamentTrainerAdminSection title="Turnier-Aliase">
                <TournamentTeamAliasesCard
                  teamSeasonId={teamSeasonId}
                  canManage={canManage}
                  reloadToken={aliasesReloadToken}
                  embedded
                />
              </TournamentTrainerAdminSection>

              {trainerFeedSection ? (
                <TournamentTrainerAdminSection title="Feed &amp; Kommunikation">
                  {trainerFeedSection}
                </TournamentTrainerAdminSection>
              ) : null}

              {trainerActions ? (
                <TournamentTrainerAdminSection title="Bearbeiten / Löschen">
                  {trainerActions}
                </TournamentTrainerAdminSection>
              ) : null}
            </TournamentTrainerAdminAccordion>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'games' ? (
        <div className={`flex flex-col ${TC_STACK_GAP}`}>
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
          ) : slots.length === 0 ? (
            <section className={TC_CARD}>
              <div className={`${TC_CARD_INNER} text-center py-2`}>
                <p className={TC_SECTION_LABEL}>Spiele</p>
                <p className="mt-2 text-[14px] text-white/55">Keine Turnierspiele geplant.</p>
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
                          isNextUpcoming={slot.id === nextMatchId}
                          onOpen={() => onOpenMatchPreparation(slot.match_id)}
                          onDelete={() => void handleRemoveSlot(slot.match_id)}
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
        <TournamentTableTab standings={groupStandings} loading={groupStandingsLoading} />
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
    </div>
  );
};
