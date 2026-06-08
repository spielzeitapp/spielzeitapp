import React, { useState } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { upsertTournamentManualGoalScorer } from '../../lib/tournamentManualGoalScorers';
import { Modal } from '../../app/ui/Modal';
import { AppButton } from '../ui/AppButton';

type Props = {
  isOpen: boolean;
  eventId: string;
  userId: string | null;
  players: PlayerItem[];
  playersLoading: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const selectClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-purple-500/45 focus:outline-none';

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

export const TournamentManualGoalScorersModal: React.FC<Props> = ({
  isOpen,
  eventId,
  userId,
  players,
  playersLoading,
  onClose,
  onSaved,
}) => {
  const [playerId, setPlayerId] = useState('');
  const [goals, setGoals] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlayers = players.filter((p) => p.is_active !== false);

  const handleSave = async () => {
    if (!playerId.trim()) {
      setError('Bitte einen Spieler wählen.');
      return;
    }
    const goalCount = Number.parseInt(goals.trim(), 10);
    if (!Number.isFinite(goalCount) || goalCount < 1) {
      setError('Bitte mindestens 1 Tor eingeben.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await upsertTournamentManualGoalScorer({
      eventId,
      playerId: playerId.trim(),
      goals: goalCount,
      userId,
    });
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPlayerId('');
    setGoals('1');
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Torschützen ergänzen"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </AppButton>
          <AppButton variant="primary" onClick={() => void handleSave()} disabled={busy || playersLoading}>
            {busy ? 'Speichern…' : 'Speichern'}
          </AppButton>
        </div>
      }
    >
      <p className="mb-3 text-[13px] text-white/65">
        Manuelle Tore werden zu den erfassten Live-Toren addiert. Es werden keine Match-Events erzeugt.
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-white/75">Spieler</span>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className={selectClass}
            disabled={playersLoading || busy}
          >
            <option value="">Spieler wählen…</option>
            {activePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.display_name}
                {player.jersey_number != null ? ` (#${player.jersey_number})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-white/75">Anzahl Tore</span>
          <input
            type="number"
            min={1}
            max={99}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            className={inputClass}
            disabled={busy}
          />
        </label>

        {error ? <p className="text-[13px] text-red-300/90">{error}</p> : null}
      </div>
    </Modal>
  );
};
