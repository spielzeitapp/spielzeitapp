import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { AppButton } from '../ui/AppButton';
import { Modal } from '../../app/ui/Modal';
import {
  dsPrimaryCtaClass,
  dsScheduleGlassButtonClass,
  dsSecondaryCtaClass,
  dsStatusChipClass,
  DS_LIST_GAP,
} from '../../lib/premiumDesignSystem';
import { DEFAULT_PLANNED_MATCH_MINUTES } from '../../lib/minimumPlaytime';
import {
  addTournamentParticipant,
  createTournamentMatchSlot,
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  formatTournamentKickoffTime,
  groupParticipantsByLabel,
  removeTournamentMatchSlot,
  removeTournamentParticipant,
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
  const [error, setError] = useState<string | null>(null);

  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantGroup, setParticipantGroup] = useState('');
  const [participantBusy, setParticipantBusy] = useState(false);

  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchKickoff, setMatchKickoff] = useState('10:00');
  const [matchMinutes, setMatchMinutes] = useState(String(DEFAULT_PLANNED_MATCH_MINUTES));
  const [matchPitch, setMatchPitch] = useState('');
  const [matchGroup, setMatchGroup] = useState('');
  const [matchBusy, setMatchBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pRes, mRes] = await Promise.all([
      fetchTournamentParticipants(tournamentEventId),
      fetchTournamentMatchSlots(tournamentEventId),
    ]);
    if (pRes.error || mRes.error) {
      setError(pRes.error ?? mRes.error);
    }
    setParticipants(pRes.data);
    setSlots(mRes.data);
    setLoading(false);
  }, [tournamentEventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const participantGroups = useMemo(() => groupParticipantsByLabel(participants), [participants]);

  const opponentSuggestions = useMemo(
    () => participants.map((p) => p.team_name).filter((n, i, arr) => arr.indexOf(n) === i),
    [participants],
  );

  const handleAddParticipant = async () => {
    setParticipantBusy(true);
    const { error: err } = await addTournamentParticipant({
      tournamentEventId,
      teamName: participantName,
      groupLabel: participantGroup || null,
    });
    setParticipantBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setParticipantName('');
    setParticipantGroup('');
    setParticipantModalOpen(false);
    void reload();
  };

  const handleAddMatch = async () => {
    setMatchBusy(true);
    const minutes = Number.parseInt(matchMinutes, 10);
    const { error: err } = await createTournamentMatchSlot({
      tournamentEventId,
      teamSeasonId,
      tournamentDayIso,
      location,
      opponentName: matchOpponent,
      kickoffTimeHHmm: matchKickoff,
      plannedMinutes: Number.isFinite(minutes) ? minutes : DEFAULT_PLANNED_MATCH_MINUTES,
      pitch: matchPitch || null,
      groupLabel: matchGroup || null,
    });
    setMatchBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setMatchOpponent('');
    setMatchKickoff('10:00');
    setMatchMinutes(String(DEFAULT_PLANNED_MATCH_MINUTES));
    setMatchPitch('');
    setMatchGroup('');
    setMatchModalOpen(false);
    void reload();
  };

  const handleRemoveParticipant = async (id: string) => {
    const { error: err } = await removeTournamentParticipant(id);
    if (err) setError(err);
    else void reload();
  };

  const handleRemoveSlot = async (matchId: string) => {
    if (!window.confirm('Turnierspiel und alle zugehörigen Match-Daten wirklich löschen?')) return;
    const { error: err } = await removeTournamentMatchSlot(matchId);
    if (err) setError(err);
    else void reload();
  };

  return (
    <>
      <Card className="border border-purple-500/20 bg-purple-950/15">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="!mb-0 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Teilnehmer
          </CardTitle>
          {canManage ? (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${dsScheduleGlassButtonClass()}`}
              onClick={() => setParticipantModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Mannschaft
            </button>
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
                          className="shrink-0 rounded-full p-0.5 text-white/45 hover:text-red-400"
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

      <Card className="border border-purple-500/20 bg-purple-950/20">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="!mb-0">Turnierplan</CardTitle>
          {canManage ? (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${dsScheduleGlassButtonClass()}`}
              onClick={() => setMatchModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Turnierspiel
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-2 text-[13px] text-red-300/90" role="alert">
            {error}
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
        open={participantModalOpen}
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Mannschaftsname *</span>
            <input
              className={inputClass}
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="z. B. Austria"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gruppe (optional)</span>
            <input
              className={inputClass}
              value={participantGroup}
              onChange={(e) => setParticipantGroup(e.target.value)}
              placeholder="A oder B"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={matchModalOpen}
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gegner *</span>
            <input
              className={inputClass}
              list="tournament-opponent-suggestions"
              value={matchOpponent}
              onChange={(e) => setMatchOpponent(e.target.value)}
              placeholder="z. B. TSV Hartberg"
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
            <span className="text-[13px] text-white/65">Spieldauer (Min.)</span>
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
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-white/65">Gruppe (optional)</span>
            <input
              className={inputClass}
              value={matchGroup}
              onChange={(e) => setMatchGroup(e.target.value)}
              placeholder="A"
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
        className="flex w-full min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-purple-500/35 hover:bg-white/[0.07]"
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
          className="mt-1 text-[12px] text-white/45 hover:text-red-400"
          onClick={onDelete}
        >
          Turnierspiel entfernen
        </button>
      ) : null}
    </li>
  );
}
