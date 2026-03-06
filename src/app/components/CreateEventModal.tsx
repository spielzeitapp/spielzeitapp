import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabaseClient';

/** Spielart → match_type in DB. UI: "Meisterschaftsspiel" statt "Liga". */
const MATCH_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'friendly', label: 'Freundschaftsspiel' },
  { value: 'league', label: 'Meisterschaftsspiel' },
  { value: 'cup', label: 'Pokal' },
  { value: 'tournament', label: 'Turnier' },
  { value: 'test', label: 'Testspiel' },
  { value: 'other', label: 'Sonstiges' },
];

export type CreateEventFormValues = {
  match_type: string;
  opponent: string;
  is_home: boolean;
  location: string;
  starts_at: string;
  meetup_at: string;
  participation_mode: 'opt_in' | 'opt_out';
};

const defaultForm: CreateEventFormValues = {
  match_type: 'friendly',
  opponent: '',
  is_home: true,
  location: '',
  starts_at: '',
  meetup_at: '',
  participation_mode: 'opt_in',
};

type CreateEventModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamSeasonId: string | null;
  onSuccess: () => void | Promise<void>;
  /** Beim Anlegen eines Spiels ist kind immer 'match'. */
  eventType?: 'match' | 'training' | 'event';
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  teamSeasonId,
  onSuccess,
  eventType = 'match',
}) => {
  const [form, setForm] = useState<CreateEventFormValues>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setForm(defaultForm);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamSeasonId) {
      setError('Keine Mannschaftssaison ausgewählt.');
      return;
    }
    const opponentVal = form.opponent.trim();
    if (!opponentVal || !form.starts_at.trim()) {
      setError('Gegner und Beginn sind Pflicht.');
      return;
    }
    setError(null);
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const startsAt = new Date(form.starts_at.trim()).toISOString();
      const meetupAt = form.meetup_at.trim() ? new Date(form.meetup_at.trim()).toISOString() : null;
      const locationVal = form.location.trim() || null;

      const kind: 'match' | 'training' | 'event' = eventType === 'match' ? 'match' : eventType === 'training' ? 'training' : 'event';
      const matchTypeVal = form.match_type?.trim() || null;

      const payload: Record<string, unknown> = {
        team_season_id: teamSeasonId,
        kind,
        opponent: opponentVal || null,
        is_home: form.is_home,
        location: locationVal,
        starts_at: startsAt,
        meetup_at: meetupAt,
        status: 'upcoming',
        participation_mode: form.participation_mode,
        created_by: user?.id ?? null,
      };
      if (matchTypeVal != null) payload.match_type = matchTypeVal;

      const { error: eventErr } = await supabase.from('events').insert(payload);

      if (eventErr) {
        setError(eventErr.message);
        setCreating(false);
        return;
      }

      handleClose();
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setCreating(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]';
  const labelClass = 'block text-sm font-medium text-[var(--text-main)] mb-1';

  return (
    <Modal
      isOpen={isOpen}
      title={eventType === 'match' ? 'Neues Spiel' : eventType === 'training' ? 'Neues Training' : 'Neuer Termin'}
      onClose={handleClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-event-form" variant="primary" disabled={creating}>
            {creating ? 'Wird angelegt…' : 'Anlegen'}
          </Button>
        </div>
      }
    >
      <form id="create-event-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="create-event-match_type" className={labelClass}>
            Spielart
          </label>
          <select
            id="create-event-match_type"
            value={form.match_type}
            onChange={(e) => setForm((f) => ({ ...f, match_type: e.target.value }))}
            className={inputClass}
          >
            {MATCH_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="create-event-opponent" className={labelClass}>
            Gegner *
          </label>
          <input
            id="create-event-opponent"
            type="text"
            required
            value={form.opponent}
            onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
            className={inputClass}
            placeholder="z. B. Team XY"
          />
        </div>
        <div>
          <span className={labelClass}>Heim / Auswärts</span>
          <div className="flex gap-4 mt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="create-event-is_home"
                checked={form.is_home === true}
                onChange={() => setForm((f) => ({ ...f, is_home: true }))}
                className="rounded-full border-[var(--glass-border)]"
              />
              <span className="text-sm text-[var(--text-main)]">Heim</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="create-event-is_home"
                checked={form.is_home === false}
                onChange={() => setForm((f) => ({ ...f, is_home: false }))}
                className="rounded-full border-[var(--glass-border)]"
              />
              <span className="text-sm text-[var(--text-main)]">Auswärts</span>
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="create-event-location" className={labelClass}>
            Ort (optional)
          </label>
          <input
            id="create-event-location"
            type="text"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className={inputClass}
            placeholder="z. B. Heimspielplatz"
          />
        </div>
        <div>
          <label htmlFor="create-event-starts_at" className={labelClass}>
            Beginn *
          </label>
          <input
            id="create-event-starts_at"
            type="datetime-local"
            required
            value={form.starts_at}
            onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="create-event-meetup_at" className={labelClass}>
            Treffpunkt (optional)
          </label>
          <input
            id="create-event-meetup_at"
            type="datetime-local"
            value={form.meetup_at}
            onChange={(e) => setForm((f) => ({ ...f, meetup_at: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="create-event-participation_mode" className={labelClass}>
            Teilnahme
          </label>
          <select
            id="create-event-participation_mode"
            value={form.participation_mode}
            onChange={(e) =>
              setForm((f) => ({ ...f, participation_mode: e.target.value as 'opt_in' | 'opt_out' }))
            }
            className={inputClass}
          >
            <option value="opt_in">Opt-in (müssen zusagen)</option>
            <option value="opt_out">Opt-out (müssen absagen)</option>
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
};
