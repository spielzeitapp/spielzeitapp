import React, { useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import { saveMissingTournamentGoal } from '../../lib/liveMatchService';
import type { RosterPlayer } from '../../lib/rosterPlayer';
import { AppButton } from '../ui/AppButton';

type Props = {
  matchId: string;
  recordedGoals: number;
  maxMinute: number;
  players: RosterPlayer[];
  onClose: () => void;
  onSaved: () => void;
};

export function TournamentGoalBackfillDialog({
  matchId,
  recordedGoals,
  maxMinute,
  players,
  onClose,
  onSaved,
}: Props) {
  const [scorer, setScorer] = useState('');
  const [minute, setMinute] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldClass = 'mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-base text-white';

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scorer || !minute || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveMissingTournamentGoal({
        matchId,
        recordedGoals,
        minute: Number(minute),
        playerId: scorer === 'own-goal' ? null : scorer,
      });
      if (result.error || !result.id) {
        setError(result.error ?? 'Das Tor konnte nicht gespeichert werden.');
        return;
      }
      onSaved();
    } catch {
      setError('Das Tor konnte nicht gespeichert werden. Bitte den Spielverlauf neu laden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Tor und Torschützen nachtragen" onClose={() => { if (!saving) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <p className="text-sm text-white/75">Das Tor wird dem gespeicherten Endstand zugeordnet und im Liveticker ergänzt.</p>
        <label className="block text-sm font-semibold text-white">
          Torschütze
          <select className={fieldClass} required value={scorer} onChange={(event) => setScorer(event.target.value)} disabled={saving}>
            <option value="">Spieler auswählen</option>
            {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            <option value="own-goal">Eigentor des Gegners</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-white">
          Spielminute
          <input className={fieldClass} type="number" inputMode="numeric" min={1} max={maxMinute} step={1} required value={minute} onChange={(event) => setMinute(event.target.value)} disabled={saving} />
        </label>
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <AppButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Abbrechen</AppButton>
          <AppButton type="submit" variant="primary" disabled={!scorer || !minute || saving}>{saving ? 'Wird gespeichert …' : 'Tor speichern'}</AppButton>
        </div>
      </form>
    </Modal>
  );
}
