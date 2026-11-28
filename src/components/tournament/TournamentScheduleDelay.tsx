import { useState, type FormEvent } from 'react';
import { Clock3 } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';

const time = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' });
const field = 'mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-black/30 px-3 text-base';

export function TournamentScheduleDelay({ eventId, slots, onSaved }: {
  eventId: string;
  slots: TournamentMatchSlotView[];
  onSaved: () => Promise<void> | void;
}) {
  const upcoming = slots.filter(slot => (
    ['upcoming', 'preparation', 'ready'].includes(slot.match_status ?? 'upcoming') &&
    ['upcoming', 'scheduled', 'planned'].includes(slot.official_status ?? 'upcoming') &&
    (slot.official_home_goals == null || slot.official_away_goals == null) &&
    Number.isFinite(Date.parse(slot.kickoff_at))
  )).sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at) || a.sort_order - b.sort_order);
  const [selection, setSelection] = useState<{ id: string; kickoff: string } | null>(null);
  const [minutes, setMinutes] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const selected = upcoming.find(slot => slot.id === selection?.id && slot.kickoff_at === selection.kickoff);
  const cutoff = Date.parse(selected?.kickoff_at ?? '');
  const valid = Number.isInteger(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 180;
  const affected = upcoming.filter(slot => Date.parse(slot.kickoff_at) >= cutoff).length;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || busy || !valid) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await supabase.rpc('delay_tournament_schedule', {
        p_event: eventId,
        p_first: selected.id,
        p_expected: selected.kickoff_at,
        p_minutes: Number(minutes),
      });
      if (saveError) {
        setError(saveError.code === 'PGRST202' ? 'Die Spielplanänderung ist noch nicht verfügbar.' : saveError.message);
        return;
      }
      setSelection(null);
      setSaved(Number(data) === 1 ? 'Ein Spiel wurde verschoben.' : `${data} Spiele wurden verschoben.`);
      await onSaved();
    } catch {
      setError('Der Spielplan konnte nicht aktualisiert werden. Bitte lade ihn neu.');
    } finally {
      setBusy(false);
    }
  };

  if (!upcoming.length && !selection && !saved) return null;
  return (
    <div>
      {upcoming.length > 0 && (
        <AppButton variant="secondary" className="w-full" onClick={() => {
          setMinutes('15');
          setError('');
          setSaved('');
          setSelection({ id: upcoming[0].id, kickoff: upcoming[0].kickoff_at });
        }}>
          <Clock3 className="mr-2 h-4 w-4" aria-hidden />
          Spielplan verschieben
        </AppButton>
      )}
      {saved && <p className="mt-2 text-sm" role="status">{saved}</p>}
      {selection && (
        <Modal open onClose={() => { if (!busy) setSelection(null); }} title="Spielplan verschieben">
          <form onSubmit={save} className="space-y-4">
            <p className="text-sm text-white/70">Die Pause verschiebt die noch nicht begonnenen Spiele ab der gewählten Begegnung.</p>
            <fieldset disabled={busy} className="space-y-4">
              <label className="block text-sm">Ab welchem Spiel?
                <select className={field} value={selected?.id ?? ''} onChange={event => {
                  const slot = upcoming.find(item => item.id === event.target.value);
                  if (slot) setSelection({ id: slot.id, kickoff: slot.kickoff_at });
                  setError('');
                }} required>
                  {!selected && <option value="">Bitte ein Spiel wählen</option>}
                  {upcoming.map(slot => (
                    <option value={slot.id} key={slot.id}>
                      {time.format(Date.parse(slot.kickoff_at))} Uhr · {slot.home_team && slot.away_team
                        ? `${slot.home_team} – ${slot.away_team}`
                        : slot.opponent_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">Verzögerung in Minuten
                <input className={field} type="number" inputMode="numeric" min={1} max={180} required
                  value={minutes} onChange={event => setMinutes(event.target.value)} />
              </label>
            </fieldset>
            {selected && valid && (
              <p className="text-sm" role="status">
                {affected === 1 ? '1 Spiel' : `${affected} Spiele`} · Neuer Anpfiff ab {time.format(cutoff + Number(minutes) * 60_000)} Uhr
              </p>
            )}
            {!selected && <p className="text-sm" role="status">Der Spielplan hat sich geändert. Bitte wähle das Spiel erneut.</p>}
            {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
            <AppButton type="submit" variant="primary" className="w-full" disabled={busy || !selected || !valid}>
              {busy ? 'Wird gespeichert …' : 'Verschiebung speichern'}
            </AppButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
