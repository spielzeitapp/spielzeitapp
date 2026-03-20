import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { enumerateOccurrenceStarts, type RecurrenceKind } from '../../lib/recurrenceDates';

/** Leerstring / Whitespace → null (Supabase/Postgres). */
function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
}

/**
 * Entfernt undefined, wandelt "" in null für optionale DB-Felder.
 * recurrence / recurrence_until / cancellation_deadline: nur Formular – im Insert nicht; meeting_point = meetup_at; description = notes.
 */
function sanitizeEventsInsertRow(row: Record<string, unknown>): Record<string, unknown> {
  const nullableStringKeys = new Set([
    'series_id',
    'address',
    'location',
    'opponent',
    'notes',
    'meetup_at',
    'meeting_at',
    'match_type',
    'created_by',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    if (nullableStringKeys.has(k)) {
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        out[k] = null;
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

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
  address: string;
  starts_at: string;
  meetup_time: string;
  participation_mode: 'opt_in' | 'opt_out';
  title: string;
  end_time: string;
  description: string;
  recurrence: RecurrenceKind;
  until_date: string;
  /** true = keine 12:00-Frist (nur Training) */
  training_absence_deadline_disabled: boolean;
};

const defaultForm: CreateEventFormValues = {
  match_type: 'friendly',
  opponent: '',
  is_home: true,
  location: '',
  address: '',
  starts_at: '',
  meetup_time: '',
  participation_mode: 'opt_in',
  title: '',
  end_time: '',
  description: '',
  recurrence: 'once',
  until_date: '',
  training_absence_deadline_disabled: false,
};

type CreateEventModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamSeasonId: string | null;
  onSuccess: () => void | Promise<void>;
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
  const [eventTypeLocal, setEventTypeLocal] = useState<'game' | 'training' | 'event' | 'other'>(
    eventType === 'training' ? 'training' : 'game',
  );

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
    const startsAtRaw = form.starts_at.trim();
    const opponentVal = form.opponent.trim();
    const titleVal = form.title.trim();

    if (!startsAtRaw) {
      setError('Beginn ist Pflicht.');
      return;
    }
    if (eventTypeLocal === 'game' && !opponentVal) {
      setError('Gegner ist Pflicht.');
      return;
    }
    if ((eventTypeLocal === 'training' || eventTypeLocal === 'event') && !titleVal) {
      setError('Titel ist Pflicht.');
      return;
    }
    setError(null);
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const startDate = new Date(startsAtRaw);
      if (isNaN(startDate.getTime())) {
        setError('Ungültiges Datumsformat.');
        setCreating(false);
        return;
      }

      const locationVal = form.location.trim() || null;
      const addressVal = form.address.trim() || null;

      const matchKind: 'match' | 'training' | 'event' =
        eventTypeLocal === 'game'
          ? 'match'
          : eventTypeLocal === 'training'
            ? 'training'
            : 'event';
      const matchTypeVal = nullIfEmpty(form.match_type);

      const buildNotes = (): string | null => {
        if (eventTypeLocal !== 'training' && eventTypeLocal !== 'event' && eventTypeLocal !== 'other') return null;
        const noteParts: string[] = [];
        if (titleVal) noteParts.push(titleVal);
        if (form.end_time.trim()) noteParts.push(`Ende: ${form.end_time.trim()} Uhr`);
        const desc = nullIfEmpty(form.description);
        if (desc) noteParts.push(desc);
        return noteParts.length > 0 ? noteParts.join(' · ') : null;
      };

      const meetupIsoForStart = (d: Date): string | null => {
        if (!form.meetup_time.trim()) return null;
        const [hh, mm] = form.meetup_time.split(':');
        const meetup = new Date(d);
        meetup.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
        return meetup.toISOString();
      };

      const canRecur =
        eventTypeLocal === 'training' || eventTypeLocal === 'event' || eventTypeLocal === 'other';
      const recurrence: RecurrenceKind =
        eventTypeLocal === 'game' ? 'once' : form.recurrence;

      let occurrenceStarts: Date[] = [new Date(startDate.getTime())];
      let seriesId: string | null = null;

      if (canRecur && recurrence !== 'once') {
        const untilRaw = form.until_date.trim();
        if (!untilRaw) {
          setError('Bitte „Wiederholen bis“ angeben oder auf Einmalig stellen.');
          setCreating(false);
          return;
        }
        const untilDate = new Date(`${untilRaw}T23:59:59`);
        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const untilDay = new Date(untilDate.getFullYear(), untilDate.getMonth(), untilDate.getDate());
        if (untilDay < startDay) {
          setError('Enddatum muss am oder nach dem ersten Termin liegen.');
          setCreating(false);
          return;
        }
        occurrenceStarts = enumerateOccurrenceStarts(startDate, recurrence, untilDate);
        if (occurrenceStarts.length === 0) {
          setError('Keine Termine im gewählten Zeitraum.');
          setCreating(false);
          return;
        }
        seriesId = crypto.randomUUID();
      }

      const notesVal = buildNotes();

      const recurrenceUntilNormalized = nullIfEmpty(form.until_date);

      const buildPayloadForStart = (d: Date): Record<string, unknown> => {
        const sid = nullIfEmpty(seriesId ?? '');
        const payload: Record<string, unknown> = {
          team_season_id: teamSeasonId,
          kind: matchKind,
          type: matchKind,
          event_type: eventTypeLocal,
          opponent: eventTypeLocal === 'game' ? nullIfEmpty(opponentVal) : null,
          is_home: eventTypeLocal === 'game' ? form.is_home : null,
          location: locationVal,
          address: addressVal,
          starts_at: d.toISOString(),
          meetup_at: meetupIsoForStart(d),
          status: 'upcoming',
          participation_mode: form.participation_mode,
          created_by: user?.id ?? null,
        };
        payload.series_id = sid;
        if (eventTypeLocal === 'game' && matchTypeVal != null) payload.match_type = matchTypeVal;
        if (notesVal) payload.notes = notesVal;
        if (eventTypeLocal === 'training') {
          payload.training_absence_deadline_disabled = Boolean(form.training_absence_deadline_disabled);
        }
        return sanitizeEventsInsertRow(payload);
      };

      const rows = occurrenceStarts.map((d) => buildPayloadForStart(d));

      console.log('[CreateEventModal] events.insert payload (exact)', JSON.parse(JSON.stringify(rows)));
      console.log('[CreateEventModal] form recurrence meta', {
        recurrence: form.recurrence,
        recurrence_until: recurrenceUntilNormalized,
        cancellation_deadline: eventTypeLocal === 'training' ? form.training_absence_deadline_disabled : null,
      });

      const { error: eventErr } = await supabase.from('events').insert(rows);

      if (eventErr) {
        const pe = eventErr as { message: string; details?: string; hint?: string; code?: string };
        console.error('[CreateEventModal] Supabase events.insert error', {
          message: pe.message,
          details: pe.details,
          hint: pe.hint,
          code: pe.code,
          raw: eventErr,
        });
        setError(eventErr.message);
        setCreating(false);
        return;
      }

      handleClose();
      await onSuccess();
    } catch (err) {
      console.error('[CreateEventModal] events.insert catch', err);
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
      title="Neuer Termin"
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
          <label htmlFor="create-event-type" className={labelClass}>
            Terminart *
          </label>
          <select
            id="create-event-type"
            value={eventTypeLocal}
            onChange={(e) =>
              setEventTypeLocal(e.target.value as 'game' | 'training' | 'event' | 'other')
            }
            className={inputClass}
          >
            <option value="game">Spiel</option>
            <option value="training">Training</option>
            <option value="event">Event</option>
            <option value="other">Sonstiges</option>
          </select>
        </div>

        {eventTypeLocal === 'game' ? (
          <>
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
          </>
        ) : eventTypeLocal === 'training' ? (
          <>
            <div>
              <label htmlFor="create-event-title" className={labelClass}>
                Titel *
              </label>
              <input
                id="create-event-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="z. B. Training, Hallentraining"
              />
            </div>
            <div>
              <label htmlFor="create-event-end_time" className={labelClass}>
                Ende (optional)
              </label>
              <input
                id="create-event-end_time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="create-event-description" className={labelClass}>
                Beschreibung (optional)
              </label>
              <textarea
                id="create-event-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
                rows={3}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--text-main)] cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-[var(--glass-border)]"
                checked={form.training_absence_deadline_disabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, training_absence_deadline_disabled: e.target.checked }))
                }
              />
              <span>
                Keine Absagefrist (Absage jederzeit möglich).{' '}
                <span className="text-[var(--text-sub)]">
                  Standard: Absage bis 12:00 Uhr am Trainingstag (Europe/Vienna).
                </span>
              </span>
            </label>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="create-event-title" className={labelClass}>
                Titel *
              </label>
              <input
                id="create-event-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="z. B. Elternabend, Team-Event"
              />
            </div>
            <div>
              <label htmlFor="create-event-description" className={labelClass}>
                Beschreibung (optional)
              </label>
              <textarea
                id="create-event-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
                rows={3}
              />
            </div>
          </>
        )}
        <div>
          <label htmlFor="create-event-location" className={labelClass}>
            Ort / Platzname (optional)
          </label>
          <input
            id="create-event-location"
            type="text"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className={inputClass}
            placeholder="z. B. Sportplatz Rohrbach"
          />
        </div>
        <div>
          <label htmlFor="create-event-address" className={labelClass}>
            Adresse (optional)
          </label>
          <input
            id="create-event-address"
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className={inputClass}
            placeholder="z. B. Sportplatzstraße 1, 3163 Rohrbach an der Gölsen"
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
          <label htmlFor="create-event-meetup_time" className={labelClass}>
            Treffpunkt (optional)
          </label>
          <input
            id="create-event-meetup_time"
            type="time"
            value={form.meetup_time}
            onChange={(e) => setForm((f) => ({ ...f, meetup_time: e.target.value }))}
            className={inputClass}
          />
        </div>
        {(eventTypeLocal === 'training' || eventTypeLocal === 'event' || eventTypeLocal === 'other') && (
          <>
            <div>
              <label htmlFor="create-event-recurrence" className={labelClass}>
                Wiederholung
              </label>
              <select
                id="create-event-recurrence"
                value={form.recurrence}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recurrence: e.target.value as RecurrenceKind }))
                }
                className={inputClass}
              >
                <option value="once">Einmalig</option>
                <option value="weekly">Wöchentlich</option>
                <option value="biweekly">Alle 2 Wochen</option>
              </select>
            </div>
            {form.recurrence !== 'once' && (
              <div>
                <label htmlFor="create-event-until" className={labelClass}>
                  Wiederholen bis *
                </label>
                <input
                  id="create-event-until"
                  type="date"
                  value={form.until_date}
                  onChange={(e) => setForm((f) => ({ ...f, until_date: e.target.value }))}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--text-sub)]">
                  Es werden alle Termine im Zeitraum als eigenständige Einträge angelegt.
                </p>
              </div>
            )}
          </>
        )}
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
