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

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  canManage: boolean;
  onOpenMatchPreparation: (matchId: string) => void;
};

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

const addButtonClass = `relative z-[2] inline-flex shrink-0 min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`;

export const TournamentDetailSections: React.FC<Props> = ({
  tournamentEventId,
  teamSeasonId,
  tournamentDayIso,
  location,
  canManage,
  onOpenMatchPreparation,
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

  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchKickoff, setMatchKickoff] = useState('10:00');
  const [matchMinutes, setMatchMinutes] = useState(String(TOURNAMENT_DEFAULT_PLANNED_MINUTES));
  const [matchPitch, setMatchPitch] = useState('');
  const [matchGroup, setMatchGroup] = useState('');
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchModalError, setMatchModalError] = useState<string | null>(null);

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

  const importPreviewCount = useMemo(
    () => parseTournamentParticipantImportLines(importText, existingTeamNames).length,
    [importText, existingTeamNames],
  );

  const opponentSuggestions = useMemo(
    () => participants.map((p) => p.team_name).filter((n, i, arr) => arr.indexOf(n) === i),
    [participants],
  );

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
    <>
      {toastMessage ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[1001] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-purple-500/35 bg-[rgba(10,8,18,0.96)] px-4 py-2.5 text-center text-[14px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:top-4 sm:bottom-auto"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      <Card className="relative border border-purple-500/20 bg-purple-950/15">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="!mb-0 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Teilnehmer
          </CardTitle>
          {canManage ? (
            <div className="relative z-[2] flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button type="button" className={addButtonClass} onClick={openParticipantModal}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Mannschaft
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
          <p className="mt-3 text-[14px] text-white/65">
            {canManage ? 'Noch keine Mannschaften — oben hinzufügen.' : 'Keine Teilnehmer eingetragen.'}
          </p>
        ) : (
          <div className={`mt-3 flex flex-col ${DS_LIST_GAP}`}>
            {participantGroups.map(({ label, items }) => (
              <div key={label ?? '_none'} className="flex flex-col gap-2">
                {label ? (
                  <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-purple-300/85">
                    Gruppe {label}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {items.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[14px] font-medium text-white/92"
                    >
                      <span className="truncate">{p.team_name}</span>
                      {canManage ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-0.5 text-white/45 hover:text-red-400 touch-manipulation"
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
          <p className="mt-3 text-[14px] text-white/65">
            {canManage ? 'Noch keine Turnierspiele — „Turnierspiel“ hinzufügen.' : 'Noch kein Turnierplan.'}
          </p>
        ) : (
          <ul className={`mt-3 flex flex-col ${DS_LIST_GAP}`}>
            {slots.map((slot) => (
              <TournamentMatchRow
                key={slot.id}
                slot={slot}
                canManage={canManage}
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
        title="Mannschaft hinzufügen"
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
    </>
  );
};

function TournamentMatchRow({
  slot,
  canManage,
  onOpen,
  onDelete,
}: {
  slot: TournamentMatchSlotView;
  canManage: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const status = tournamentMatchDisplayStatus(slot);
  const timeLabel = formatTournamentKickoffTime(slot.kickoff_at);
  const meta = [slot.pitch?.trim(), slot.group_label?.trim() ? `Gr. ${slot.group_label.trim()}` : null]
    .filter(Boolean)
    .join(' · ');

  const chipTone =
    status.kind === 'live'
      ? 'selected'
      : status.kind === 'result'
        ? 'present'
        : status.kind === 'preparation'
          ? 'open'
          : 'neutral';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-purple-500/35 hover:bg-white/[0.07] touch-manipulation"
      >
        <span className="w-[52px] shrink-0 text-[17px] font-bold tabular-nums text-white">{timeLabel}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-white">{slot.opponent_name}</span>
          {meta ? <span className="mt-0.5 block text-[12px] text-white/55">{meta}</span> : null}
          <span className="mt-1 inline-flex">
            <span className={dsStatusChipClass(chipTone)}>{status.label}</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" strokeWidth={2} aria-hidden />
      </button>
      {canManage ? (
        <button
          type="button"
          className="mt-1 text-[12px] text-white/45 hover:text-red-400 touch-manipulation"
          onClick={onDelete}
        >
          Turnierspiel entfernen
        </button>
      ) : null}
    </li>
  );
}
