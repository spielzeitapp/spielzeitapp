/**
 * Trainer-Notfall: eigenes Turnierspiel korrigieren ohne Official-Link zu zerstören.
 */
import React, { useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { updateOwnTournamentSlotSchedule, formatTournamentKickoffTime } from '../../lib/tournamentPlan';
import { updateMatchRow } from '../../lib/liveMatchService';
import { meetupUtcIsoOnViennaEventDay } from '../../lib/viennaTime';
import { safeOptionalText, safeText } from '../../lib/safeText';

type Props = {
  open: boolean;
  onClose: () => void;
  slot: TournamentMatchSlotView;
  tournamentDayIso: string;
  ourTeamName: string;
  onSaved: () => void;
};

export function TournamentOwnMatchEditSheet({
  open,
  onClose,
  slot,
  tournamentDayIso,
  ourTeamName,
  onSaved,
}: Props): React.ReactElement | null {
  const [opponent, setOpponent] = useState(safeText(slot.opponent_name));
  const [kickoff, setKickoff] = useState(formatTournamentKickoffTime(slot.kickoff_at) || '12:00');
  const [pitch, setPitch] = useState(safeText(slot.pitch));
  const [phase, setPhase] = useState(safeText(slot.phase));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const status = (slot.match_status ?? 'upcoming').toLowerCase();
  const canEdit = status === 'upcoming' || status === 'preparation' || status === 'ready';

  const save = async () => {
    if (!canEdit) {
      setError('Nur bevor das Spiel startet bearbeitbar.');
      return;
    }
    const opp = opponent.trim();
    if (!opp) {
      setError('Gegner fehlt.');
      return;
    }
    const kickoffIso = meetupUtcIsoOnViennaEventDay(tournamentDayIso, kickoff);
    if (!kickoffIso) {
      setError('Ungültige Uhrzeit.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const homeWasOurs =
        safeOptionalText(slot.home_team) &&
        safeText(slot.home_team).toLowerCase().includes(ourTeamName.toLowerCase().slice(0, 6));
      const homeTeam = homeWasOurs ? safeText(slot.home_team) || ourTeamName : opp;
      const awayTeam = homeWasOurs ? opp : safeText(slot.away_team) || ourTeamName;

      const slotRes = await updateOwnTournamentSlotSchedule({
        slotId: slot.id,
        kickoffAtIso: kickoffIso,
        pitch: pitch.trim() || null,
        phase: phase.trim() || null,
        homeTeam,
        awayTeam,
        opponentName: opp,
        provider: slot.provider,
        externalMatchId: slot.external_match_id,
      });
      if (slotRes.error) {
        setError(slotRes.error);
        return;
      }

      if (slot.match_id) {
        const matchRes = await updateMatchRow(slot.match_id, {
          opponent: opp,
        });
        if (matchRes.error) {
          setError(matchRes.error);
          return;
        }
      }

      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title="Spiel bearbeiten">
      <div className="space-y-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <p className="text-xs text-white/55">
          Notfall-Korrektur für Trainer. Official-Verknüpfung bleibt erhalten.
        </p>
        <label className="block text-xs text-white/70">
          Gegner
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            disabled={busy || !canEdit}
          />
        </label>
        <label className="block text-xs text-white/70">
          Beginn (HH:MM)
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            disabled={busy || !canEdit}
          />
        </label>
        <label className="block text-xs text-white/70">
          Platz
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            disabled={busy || !canEdit}
          />
        </label>
        <label className="block text-xs text-white/70">
          Phase / Bezeichnung
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            disabled={busy || !canEdit}
            placeholder="z. B. placement"
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white/85"
            onClick={onClose}
            disabled={busy}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void save()}
            disabled={busy || !canEdit}
          >
            {busy ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
