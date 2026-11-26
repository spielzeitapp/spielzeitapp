import React, { useEffect, useState } from 'react';
import { AppButton } from '../ui/AppButton';
import { DEFAULT_TOURNAMENT_MATCH_RULES, fetchTournamentMatchRules, saveTournamentMatchRules, type TournamentMatchRules } from '../../lib/tournamentMatchRules';

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/30 px-3 text-base';

export function TournamentMatchRulesPanel({ eventId, onSaved }: { eventId: string; onSaved: () => void }) {
  const [stored, setStored] = useState<TournamentMatchRules | null>(null);
  const [duration, setDuration] = useState('');
  const [minimum, setMinimum] = useState('');
  const [penalty, setPenalty] = useState('');
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchTournamentMatchRules(eventId).then(result => {
      if (!active) return;
      const rules = result.rules ?? DEFAULT_TOURNAMENT_MATCH_RULES;
      setStored(result.rules);
      setDuration(String(rules.duration));
      setMinimum(rules.minimum == null ? '' : String(rules.minimum));
      setPenalty(String(rules.penalty));
      setError(result.error);
      setLoaded(!result.error);
      setBusy(false);
    });
    return () => { active = false; };
  }, [eventId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loaded || busy) return;
    setBusy(true);
    setSaved(false);
    const result = await saveTournamentMatchRules(eventId, {
      duration: Number(duration), minimum: minimum === '' ? null : Number(minimum), penalty: Number(penalty),
    }, stored);
    setBusy(false);
    setError(result.error);
    if (!result.rules) return;
    setStored(result.rules);
    setSaved(true);
    onSaved();
  };

  return (
    <form onSubmit={save} onChange={() => setSaved(false)} className="mb-4 space-y-3 rounded-2xl border border-white/15 p-3">
      <h3 className="text-lg font-bold">Spielzeit fürs Turnier</h3>
      <p className="text-sm text-white/65">Die Vorgabe gilt für unsere kommenden Spiele. Einzelne Spiele kannst du in der Spielvorbereitung abweichend einstellen.</p>
      <fieldset disabled={busy || !loaded} className="space-y-3 disabled:opacity-60">
        <label className="block text-sm">Spieldauer pro Spiel (Min.)
          <input className={inputClass} type="number" inputMode="numeric" min="1" max="120" required value={duration} onChange={e => setDuration(e.target.value)} />
        </label>
        <label className="block text-sm">Mindestspielzeit pro Spieler (Min.)
          <input className={inputClass} type="number" inputMode="numeric" min="1" max={Number(duration) || 120} placeholder="Optional" value={minimum} onChange={e => setMinimum(e.target.value)} />
        </label>
        <label className="block text-sm">Zeitstrafe (Min.)
          <input className={inputClass} type="number" inputMode="numeric" min="1" max="15" required value={penalty} onChange={e => setPenalty(e.target.value)} />
        </label>
        <AppButton type="submit" variant="primary" className="w-full">Turniervorgaben speichern</AppButton>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-300">Turniervorgaben gespeichert.</p>}
    </form>
  );
}
