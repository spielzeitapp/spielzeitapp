import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { enumerateOccurrenceStarts, type RecurrenceKind } from '../../lib/recurrenceDates';
import { createReminderJobs } from '../../lib/reminders/syncReminderJobsAfterEventWrite';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  viennaDateOnlyEndOfDayUtcIso,
} from '../../lib/viennaTime';
import { formatEventDateVienna, formatEventTimeVienna } from '../../lib/notifications/format';
import { combineLocationParts, formatFullLocation } from '../../lib/eventLocation';

/** Leerstring / Whitespace → null (Supabase/Postgres). */
function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
}

/**
 * Entfernt undefined, wandelt "" in null für optionale DB-Felder.
 * recurrence / recurrence_until / cancellation_deadline: nur Formular – im Insert nicht; meeting_point = meeting_at; description = notes.
 */
function sanitizeEventsInsertRow(row: Record<string, unknown>): Record<string, unknown> {
  const nullableStringKeys = new Set([
    'location',
    'opponent',
    'notes',
    'meeting_at',
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

/** Spielart-Auswahl (nur UI-seitig). */
const MATCH_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'friendly', label: 'Freundschaftsspiel' },
  { value: 'league', label: 'Meisterschaftsspiel' },
  { value: 'cup', label: 'Pokal' },
  { value: 'tournament', label: 'Turnier' },
  { value: 'test', label: 'Testspiel' },
  { value: 'other', label: 'Sonstiges' },
];

export type CreateEventFormValues = {
  opponent: string;
  is_home: boolean;
  location: string;
  location_address: string;
  starts_at: string;
  meetup_time: string;
  participation_mode: 'opt_in' | 'opt_out';
  match_type: string;
  title: string;
  end_time: string;
  description: string;
  recurrence: RecurrenceKind;
  until_date: string;
  /** true = keine 12:00-Frist (nur Training) */
  training_absence_deadline_disabled: boolean;
};

const defaultForm: CreateEventFormValues = {
  opponent: '',
  is_home: true,
  location: '',
  location_address: '',
  starts_at: '',
  meetup_time: '',
  participation_mode: 'opt_in',
  match_type: 'friendly',
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
    const startsAtRaw = (form.starts_at ?? '').trim();
    const opponentVal = (form.opponent ?? '').trim();
    const titleVal = (form.title ?? '').trim();

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
      const firstStartUtcIso = parseViennaDateTimeLocalToUtcIso(startsAtRaw);
      if (!firstStartUtcIso) {
        setError('Ungültiges Datumsformat.');
        setCreating(false);
        return;
      }
      const startDate = new Date(firstStartUtcIso);

      const locationVal = combineLocationParts(form.location, form.location_address);

      const matchKind: 'match' | 'training' | 'event' =
        eventTypeLocal === 'game'
          ? 'match'
          : eventTypeLocal === 'training'
            ? 'training'
            : 'event';

      const buildNotes = (): string | null => {
        if (eventTypeLocal !== 'training' && eventTypeLocal !== 'event' && eventTypeLocal !== 'other') return null;
        const noteParts: string[] = [];
        if (titleVal) noteParts.push(titleVal);
        if ((form.end_time ?? '').trim()) noteParts.push(`Ende: ${(form.end_time ?? '').trim()} Uhr`);
        const desc = nullIfEmpty(form.description);
        if (desc) noteParts.push(desc);
        return noteParts.length > 0 ? noteParts.join(' · ') : null;
      };

      const meetupIsoForStart = (d: Date): string | null => {
        const meetup = (form.meetup_time ?? '').trim();
        if (!meetup) return null;
        return meetupUtcIsoOnViennaEventDay(d.toISOString(), meetup);
      };

      const canRecur =
        eventTypeLocal === 'training' || eventTypeLocal === 'event' || eventTypeLocal === 'other';
      const recurrence: RecurrenceKind =
        eventTypeLocal === 'game' ? 'once' : form.recurrence;

      let occurrenceStarts: Date[] = [new Date(startDate.getTime())];
      let seriesId: string | null = null;

      if (canRecur && recurrence !== 'once') {
        const untilRaw = (form.until_date ?? '').trim();
        if (!untilRaw) {
          setError('Bitte „Wiederholen bis“ angeben oder auf Einmalig stellen.');
          setCreating(false);
          return;
        }
        const untilEndIso = viennaDateOnlyEndOfDayUtcIso(untilRaw);
        if (!untilEndIso) {
          setError('Ungültiges Enddatum.');
          setCreating(false);
          return;
        }
        if (new Date(untilEndIso).getTime() < new Date(firstStartUtcIso).getTime()) {
          setError('Enddatum muss am oder nach dem ersten Termin liegen.');
          setCreating(false);
          return;
        }
        occurrenceStarts = enumerateOccurrenceStarts(firstStartUtcIso, recurrence, untilEndIso);
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
        const payload: Record<string, unknown> = {
          team_season_id: teamSeasonId,
          kind: matchKind,
          type: matchKind,
          opponent: eventTypeLocal === 'game' ? nullIfEmpty(opponentVal) : null,
          is_home: eventTypeLocal === 'game' ? form.is_home : null,
          location: locationVal,
          starts_at: d.toISOString(),
          meeting_at: meetupIsoForStart(d),
          status: 'upcoming',
          attendance_mode: form.participation_mode,
          created_by: user?.id ?? null,
        };
        if (notesVal) payload.notes = notesVal;
        return sanitizeEventsInsertRow(payload);
      };

      const rows = occurrenceStarts.map((d) => buildPayloadForStart(d));

      console.log('[CreateEventModal] events.insert payload (exact)', JSON.parse(JSON.stringify(rows)));
      console.log('[CreateEventModal] form recurrence meta', {
        recurrence: form.recurrence,
        recurrence_until: recurrenceUntilNormalized,
        cancellation_deadline: eventTypeLocal === 'training' ? form.training_absence_deadline_disabled : null,
      });

      const { data: insertedRows, error: eventErr } = await supabase
        .from('events')
        .insert(rows)
        .select('*');

      if (eventErr) {
        const pe = eventErr as { message: string; details?: string; hint?: string; code?: string };
        console.error('[reminderPipeline] events.insert failed', {
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

      console.log('[reminderPipeline] events.insert ok', {
        rowCount: Array.isArray(insertedRows) ? insertedRows.length : 0,
        ids: Array.isArray(insertedRows) ? insertedRows.map((r: { id?: string }) => r.id).filter(Boolean) : [],
      });

      let rowsToSync: Record<string, unknown>[] = Array.isArray(insertedRows) ? [...insertedRows] : [];
      if (rowsToSync.length === 0 && rows.length > 0) {
        const since = new Date(Date.now() - 20_000).toISOString();
        const { data: refetched, error: refetchErr } = await supabase
          .from('events')
          .select('*')
          .eq('team_season_id', teamSeasonId)
          .gte('created_at', since)
          .order('created_at', { ascending: true });
        if (refetchErr) {
          console.error('[CreateEventModal] REMINDER refetch after insert failed', refetchErr.message);
        } else if (refetched?.length) {
          console.log('[CreateEventModal] REMINDER using refetched events after empty insert.select', refetched.length);
          rowsToSync = refetched as Record<string, unknown>[];
        } else {
          console.warn('[CreateEventModal] REMINDER no rows from insert.select and refetch empty');
        }
      }

      try {
        // Pro Event-ID höchstens ein sync (verhindert Doppel-Lauf bei insert.select + Refetch-Überlappung)
        const syncedEventIds = new Set<string>();
        for (const row of rowsToSync) {
          const eid = (row as { id?: string }).id;
          if (!eid || syncedEventIds.has(eid)) continue;
          syncedEventIds.add(eid);
          const syncRes = await createReminderJobs(supabase, row);
          console.log('[reminderPipeline] event created → reminder jobs sync', {
            eventId: eid,
            inserted: syncRes?.inserted,
            error: syncRes?.error ?? null,
          });
        }
      } catch (e) {
        console.error('[reminderPipeline] reminder sync loop error', e);
      }

      // MVP: Automatische Nachricht + Push für „Neuer Termin / Event erstellt“
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        const accessToken = sessionRes.session?.access_token;
        if (accessToken && teamSeasonId) {
          const firstEventId = (Array.isArray(insertedRows) ? insertedRows[0] : null)?.id ?? null;
          const dateStr = formatEventDateVienna(startDate.toISOString());
          const timeStr = formatEventTimeVienna(startDate.toISOString());

          const ortVal = formatFullLocation(form.location, form.location_address);
          const treffpunktVal = (form.meetup_time ?? '').trim();
          let titleForMsg = '';
          let contentForMsg = '';
          if (eventTypeLocal === 'training') {
            titleForMsg = 'Neues Training';
            contentForMsg = `Für dein Team wurde ein neuer Termin erstellt: Training am ${dateStr} um ${timeStr}.`;
          } else if (eventTypeLocal === 'game') {
            titleForMsg = 'Neues Spiel';
            contentForMsg = `Für dein Team wurde ein neuer Termin erstellt: Spiel am ${dateStr} um ${timeStr}.`;
          } else if (eventTypeLocal === 'event') {
            titleForMsg = 'Neues Event';
            contentForMsg = `Für dein Team wurde ein neuer Termin erstellt: Event am ${dateStr} um ${timeStr}.`;
          } else {
            titleForMsg = 'Neues Event';
            contentForMsg = `Für dein Team wurde ein neuer Termin erstellt: Termin am ${dateStr} um ${timeStr}.`;
          }

          if (ortVal) {
            contentForMsg += ` Ort: ${ortVal}.`;
          }
          if (treffpunktVal) {
            contentForMsg += ` Treffpunkt: ${treffpunktVal}.`;
          }

          await fetch('/api/push/send-team', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              team_season_id: teamSeasonId,
              recipient_group: 'all',
              title: titleForMsg,
              body: contentForMsg,
              url: '/app/nachrichten',
              message_type: 'event_created',
              related_event_id: firstEventId,
            }),
          });
        }
      } catch {
        // best-effort: Nachricht/Push darf nicht das Event anlegen blockieren
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
            Platzname / Ort (optional)
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
          <label htmlFor="create-event-location-address" className={labelClass}>
            Adresse / PLZ / Ort (optional)
          </label>
          <input
            id="create-event-location-address"
            type="text"
            value={form.location_address}
            onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
            className={inputClass}
            placeholder="z. B. Sportplatzstraße 1, 3163 Rohrbach"
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
