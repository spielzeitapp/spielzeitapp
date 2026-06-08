import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileInput, Plus, Trash2, Users } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { AppButton } from '../ui/AppButton';
import { Modal } from '../../app/ui/Modal';
import {
  dsScheduleGlassButtonClass,
  dsStatusChipClass,
  DS_LIST_GAP,
} from '../../lib/premiumDesignSystem';
import {
  addTournamentParticipant,
  computeTournamentHeroSummary,
  computeTournamentTeamBalance,
  createTournamentMatchSlot,
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  formatTournamentKickoffTime,
  groupParticipantsByLabel,
  importTournamentParticipantsBulk,
  parseTournamentParticipantImportLines,
  removeTournamentMatchSlot,
  removeTournamentParticipant,
  TOURNAMENT_DEFAULT_PLANNED_MINUTES,
  tournamentImportSuccessMessage,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
  type TournamentParticipant,
} from '../../lib/tournamentPlan';
import { computeTournamentFinalSummary } from '../../lib/tournamentFinalSummary';
import { computeTournamentGroupStandings, type TournamentGroupStandings } from '../../lib/tournamentGroupStandings';
import {
  analyzeTournamentUrl,
  fetchTournamentImportRecognition,
  type TournamentPlanImportRawMatch,
} from '../../lib/tournamentPlanImport';
import { TournamentBalanceCard } from './TournamentBalanceCard';
import { TournamentFinalSummaryCard } from './TournamentFinalSummaryCard';
import { TournamentGroupStandingCard } from './TournamentGroupStandingCard';
import { TournamentHeroCard } from './TournamentHeroCard';
import { TournamentOfficialPlanCard } from './TournamentOfficialPlanCard';
import { TournamentTeamAliasesCard } from './TournamentTeamAliasesCard';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  tournamentTitle: string;
  location: string | null;
  officialTournamentUrl: string | null;
  canManage: boolean;
  onOpenMatchPreparation: (matchId: string) => void;
  onOfficialTournamentUrlUpdated: (url: string | null) => void;
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
  canManage,
  onOpenMatchPreparation,
  onOfficialTournamentUrlUpdated,
}) => {
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

  const participantGroups = useMemo(() => groupParticipantsByLabel(participants), [participants]);

  const existingTeamNames = useMemo(() => participants.map((p) => p.team_name), [participants]);

  const scrollToTeamAliases = useCallback(() => {
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

  useEffect(() => {
    const planUrl = officialTournamentUrl?.trim();
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
    <div className="flex min-w-0 flex-col gap-5 overflow-x-hidden">
      {toastMessage ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[1001] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-purple-500/35 bg-[rgba(10,8,18,0.96)] px-4 py-2.5 text-center text-[14px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:top-4 sm:bottom-auto"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      <TournamentHeroCard
        tournamentTitle={tournamentTitle}
        participants={participants}
        slots={slots}
        loading={loading}
      />

      <TournamentBalanceCard balance={teamBalance} loading={loading} />

      <TournamentFinalSummaryCard
        balance={teamBalance}
        summary={finalSummary}
        loading={loading || groupStandingsLoading}
      />

      <TournamentGroupStandingCard standings={groupStandings} loading={groupStandingsLoading} />

      <TournamentOfficialPlanCard
        tournamentEventId={tournamentEventId}
        teamSeasonId={teamSeasonId}
        tournamentDayIso={tournamentDayIso}
        location={location}
        officialTournamentUrl={officialTournamentUrl}
        existingTeamNames={participants.map((p) => p.team_name)}
        existingSlots={slots}
        canManage={canManage}
        onUrlUpdated={onOfficialTournamentUrlUpdated}
        onImportComplete={() => void reload()}
        onScrollToAliases={scrollToTeamAliases}
      />

      <TournamentTeamAliasesCard
        teamSeasonId={teamSeasonId}
        canManage={canManage}
        reloadToken={aliasesReloadToken}
      />

      <Card className="relative border border-purple-500/20 bg-purple-950/15">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <CardTitle className="!mb-0 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Teilnehmer
          </CardTitle>
          {canManage ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" className={addButtonClass} onClick={openParticipantModal}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Team
              </button>
              <button type="button" className={addButtonClass} onClick={openImportModal}>
                <FileInput className="h-3.5 w-3.5" aria-hidden />
                Importieren
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-3 text-[14px] text-white/65">Lade Teilnehmer…</p>
        ) : participants.length === 0 ? (
          <p className="mt-3 text-[14px] text-white/65">Keine Teams hinzugefügt</p>
        ) : (
          <div className={`mt-3 flex flex-col ${DS_LIST_GAP}`}>
            {participantGroups.map(({ label, items }) => (
              <div key={label ?? '_none'} className="flex flex-col gap-1.5">
                {label ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-purple-200/90">Gruppe {label}</p>
                    <span className="inline-flex items-center rounded-full border border-purple-500/35 bg-purple-950/55 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200/90">
                      {label} ({items.length})
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-white/55">Ohne Gruppe</p>
                    <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/55">
                      ({items.length})
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {items.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex max-w-full items-start gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1"
                    >
                      <span className="min-w-0 max-w-[min(100%,14rem)] break-words text-[13px] font-medium leading-snug text-white/90 line-clamp-2">
                        {p.team_name}
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 rounded-full p-0.5 text-white/45 hover:text-red-400 touch-manipulation"
                          aria-label={`${p.team_name} entfernen`}
                          onClick={() => void handleRemoveParticipant(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="relative border border-purple-500/20 bg-purple-950/20">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="!mb-0">Turnierplan</CardTitle>
          {canManage ? (
            <button
              type="button"
              className={addButtonClass}
              onClick={openMatchModal}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Turnierspiel
            </button>
          ) : null}
        </div>

        {listError ? (
          <p className="mt-2 text-[13px] text-red-300/90" role="alert">
            {listError}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-3 text-[14px] text-white/65">Lade Turnierplan…</p>
        ) : slots.length === 0 ? (
          <p className="mt-3 text-[14px] text-white/65">Keine Turnierspiele geplant</p>
        ) : (
          <ul className={`mt-3 flex flex-col ${DS_LIST_GAP}`}>
            {slots.map((slot) => (
              <TournamentMatchRow
                key={slot.id}
                slot={slot}
                canManage={canManage}
                isNextUpcoming={slot.id === nextMatchId}
                onOpen={() => onOpenMatchPreparation(slot.match_id)}
                onDelete={() => void handleRemoveSlot(slot.match_id)}
              />
            ))}
          </ul>
        )}
      </Card>

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

function tournamentMatchPhaseBadge(phase: string | null | undefined): string | null {
  const p = (phase ?? '').trim().toLowerCase();
  if (p === 'final') return 'FINALE';
  if (p === 'semifinal') return 'HALBFINALE';
  if (p === 'placement') return 'PLATZIERUNG';
  return null;
}

function tournamentMatchBadgeLabel(
  slot: TournamentMatchSlotView,
  status: ReturnType<typeof tournamentMatchDisplayStatus>,
): string {
  const group = slot.group_label?.trim();
  const phaseBadge = tournamentMatchPhaseBadge(slot.phase);
  if (status.kind === 'planned' && phaseBadge) {
    return phaseBadge;
  }
  if (status.kind === 'planned' && group) {
    return `GRUPPE ${group.toUpperCase()}`;
  }
  return status.label;
}

function TournamentMatchRow({
  slot,
  canManage,
  isNextUpcoming,
  onOpen,
  onDelete,
}: {
  slot: TournamentMatchSlotView;
  canManage: boolean;
  isNextUpcoming: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const status = tournamentMatchDisplayStatus(slot);
  const badgeLabel = tournamentMatchBadgeLabel(slot, status);
  const timeLabel = formatTournamentKickoffTime(slot.kickoff_at);
  const meta = slot.pitch?.trim() ?? '';

  const chipTone =
    status.kind === 'live'
      ? 'selected'
      : status.kind === 'result'
        ? 'present'
        : status.kind === 'preparation'
          ? 'open'
          : 'neutral';

  const scoreLine =
    status.kind === 'result' ? `${status.ourGoals}:${status.oppGoals}` : null;

  const subline = [scoreLine ? `Ergebnis: ${scoreLine}` : null, meta].filter(Boolean).join(' · ');

  const cardShellClass = isNextUpcoming
    ? 'border-purple-400/50 bg-[linear-gradient(135deg,rgba(88,28,135,0.26)_0%,rgba(251,191,36,0.06)_48%,rgba(255,255,255,0.04)_100%)] shadow-[0_0_28px_rgba(168,85,247,0.14),inset_0_1px_0_rgba(251,191,36,0.12)]'
    : 'border-white/10 bg-white/[0.04]';

  return (
    <li>
      <div className={`relative overflow-hidden rounded-xl border transition ${cardShellClass}`}>
        {isNextUpcoming ? (
          <span className="absolute left-3 top-2.5 z-[1] text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">
            Nächstes Spiel
          </span>
        ) : null}
        {canManage ? (
          <button
            type="button"
            className="absolute bottom-2.5 right-2 z-[3] rounded-full p-1.5 text-white/40 hover:bg-red-500/15 hover:text-red-400 touch-manipulation sm:bottom-auto sm:right-2 sm:top-2"
            aria-label={`${slot.opponent_name} entfernen`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          className="relative flex w-full text-left touch-manipulation"
        >
          {/* Mobile: gestapelt, Gegner voll lesbar */}
          <div
            className={`flex w-full flex-col gap-2 px-3 pb-3 sm:hidden ${
              isNextUpcoming ? 'pt-8' : 'pt-3'
            } ${canManage ? 'pr-11' : 'pr-10'}`}
          >
            <p className="text-[14px] font-semibold tabular-nums text-purple-200/90">{timeLabel} Uhr</p>
            {scoreLine ? (
              <p className="text-[20px] font-bold leading-[1.2] text-white break-words">
                <span className="tabular-nums text-emerald-300/95">{scoreLine}</span>
                <span className="text-white/70"> · </span>
                <span className="line-clamp-2">{slot.opponent_name}</span>
              </p>
            ) : (
              <p className="text-[20px] font-bold leading-[1.2] text-white break-words line-clamp-2">
                {slot.opponent_name}
              </p>
            )}
            {subline ? <p className="text-[12px] leading-snug text-white/55 break-words">{subline}</p> : null}
            <span className={`self-start ${dsStatusChipClass(chipTone)}`}>{badgeLabel}</span>
          </div>

          {/* Desktop: kompakte Zeile */}
          <div
            className={`hidden min-h-[56px] w-full items-center gap-3 px-3 py-2.5 sm:flex ${
              canManage ? 'pr-16' : 'pr-10'
            } ${isNextUpcoming ? 'pt-7' : ''}`}
          >
            <span className="w-[52px] shrink-0 text-[17px] font-bold tabular-nums text-white">{timeLabel}</span>
            <span className="min-w-0 flex-1">
              {scoreLine ? (
                <span className="block text-[16px] font-semibold leading-snug text-white break-words">
                  <span className="tabular-nums text-emerald-300/95">{scoreLine}</span>
                  <span className="text-white/70"> · </span>
                  <span className="line-clamp-2">{slot.opponent_name}</span>
                </span>
              ) : (
                <span className="block text-[16px] font-semibold leading-snug text-white break-words line-clamp-2">
                  {slot.opponent_name}
                </span>
              )}
              {subline ? (
                <span className="mt-0.5 block text-[12px] leading-snug text-white/55 break-words">{subline}</span>
              ) : null}
            </span>
            <span className={`shrink-0 ${dsStatusChipClass(chipTone)}`}>{badgeLabel}</span>
          </div>

          <ChevronRight
            className="pointer-events-none absolute right-3 top-1/2 z-[2] h-5 w-5 -translate-y-1/2 text-white/35 sm:right-9"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </div>
    </li>
  );
}
