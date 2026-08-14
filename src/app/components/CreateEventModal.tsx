import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { enumerateOccurrenceStarts, type RecurrenceKind } from '../../lib/recurrenceDates';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  viennaDateOnlyEndOfDayUtcIso,
} from '../../lib/viennaTime';
import { combineLocationParts, formatFullLocation } from '../../lib/eventLocation';
import { eventKindFromFormType, normalizeEventTypeField } from '../../lib/eventTypeUtils';
import { assertTeamSeasonWritable } from '../../lib/seasonTransition';
import { locationTextFromVenue, resolveClubIdForTeamSeason, type VenueRow } from '../../lib/venues';
import { VenuePicker } from '../../components/venues/VenuePicker';
import {
  TrainingFacilityFields,
  type TrainingFacilitySelection,
} from '../../components/venues/TrainingFacilityFields';
import { upsertEventFieldAssignment, defaultEventEndsAt } from '../../lib/eventFieldAssignments';
import {
  EventDateField,
  EventTimeField,
  EVENT_FORM_INPUT_CLASS,
  EVENT_FORM_LABEL_CLASS,
} from '../../components/events';

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
    'venue_id',
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
  { value: 'tournament', label: 'Turnier' },
  { value: 'test', label: 'Testspiel' },
];

/** Nur diese Werte werden bei Spiel-Terminen in `events.match_type` geschrieben. */
const MATCH_TYPE_SAVE_VALUES = ['friendly', 'league', 'tournament', 'test'] as const;

export type CreateEventFormValues = {
  opponent: string;
  is_home: boolean;
  location: string;
  location_address: string;
  /** Kalendertag Europe/Vienna `YYYY-MM-DD` */
  start_date: string;
  /** Anpfiff/Beginn `HH:mm` */
  start_time: string;
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
  start_date: '',
  start_time: '',
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
  eventType?: 'match' | 'training' | 'event' | 'tournament';
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  teamSeasonId,
  onSuccess,
  eventType = 'match',
}) => {
  const [form, setForm] = useState<CreateEventFormValues>(defaultForm);
  const [selectedVenue, setSelectedVenue] = useState<VenueRow | null>(null);
  const [trainingFacility, setTrainingFacility] = useState<TrainingFacilitySelection>({
    fieldId: null,
    zoneId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [eventTypeLocal, setEventTypeLocal] = useState<
    'game' | 'training' | 'event' | 'other' | 'tournament'
  >(
    eventType === 'training'
      ? 'training'
      : eventType === 'tournament'
        ? 'tournament'
        : eventType === 'event'
          ? 'event'
          : 'game',
  );

  const resetForm = () => {
    setForm(defaultForm);
    setSelectedVenue(null);
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

    const writable = await assertTeamSeasonWritable(teamSeasonId);
    if (!writable.ok) {
      setError(writable.message);
      return;
    }
    const startDate = (form.start_date ?? '').trim();
    const startTime = (form.start_time ?? '').trim();
    const startsAtRaw = startDate && startTime ? `${startDate}T${startTime}` : '';
    const opponentVal = (form.opponent ?? '').trim();
    const titleVal = (form.title ?? '').trim();

    if (!startDate || !startTime) {
      setError('Datum und Beginn sind Pflicht.');
      return;
    }
    if (eventTypeLocal === 'game' && !opponentVal) {
      setError('Gegner ist Pflicht.');
      return;
    }
    if (
      (eventTypeLocal === 'training' ||
        eventTypeLocal === 'event' ||
        eventTypeLocal === 'tournament') &&
      !titleVal
    ) {
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

      const locationVal = selectedVenue
        ? locationTextFromVenue(selectedVenue)
        : combineLocationParts(form.location, form.location_address);

      const eventKind = eventKindFromFormType(eventTypeLocal);
      const eventType = normalizeEventTypeField(eventKind, eventKind);

      const buildNotes = (): string | null => {
        if (eventTypeLocal === 'game') return null;
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
        eventTypeLocal === 'training' ||
        eventTypeLocal === 'event' ||
        eventTypeLocal === 'other' ||
        eventTypeLocal === 'tournament';
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
        const mtRaw = String(form.match_type ?? '').trim().toLowerCase();
        const match_type: string | null =
          eventTypeLocal === 'game' && (MATCH_TYPE_SAVE_VALUES as readonly string[]).includes(mtRaw)
            ? mtRaw
            : null;
        const payload: Record<string, unknown> = {
          team_season_id: teamSeasonId,
          kind: eventKind,
          type: eventType,
          match_type,
          opponent: eventTypeLocal === 'game' ? nullIfEmpty(opponentVal) : null,
          is_home: eventTypeLocal === 'game' ? form.is_home : null,
          location: locationVal,
          venue_id: selectedVenue?.id ?? null,
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
      for (const row of rows) {
        console.log('saved event kind', row.kind);
      }

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

      if (
        eventTypeLocal === 'training' &&
        selectedVenue?.id &&
        trainingFacility.fieldId &&
        Array.isArray(insertedRows) &&
        insertedRows.length > 0
      ) {
        const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
        if (clubRes.clubId) {
          for (const ev of insertedRows as Array<{ id: string; starts_at: string; kind?: string; type?: string; notes?: string | null }>) {
            const endsAt = defaultEventEndsAt({
              startsAtIso: ev.starts_at,
              kind: ev.kind ?? 'training',
              type: ev.type,
              notes: ev.notes,
            });
            const assignRes = await upsertEventFieldAssignment({
              clubId: clubRes.clubId,
              eventId: ev.id,
              venueId: selectedVenue.id,
              fieldId: trainingFacility.fieldId,
              zoneId: trainingFacility.zoneId,
              startsAt: ev.starts_at,
              endsAt,
            });
            if (assignRes.error) {
              setError(
                `Training gespeichert, aber Platzzuordnung fehlgeschlagen: ${assignRes.error}`,
              );
              setCreating(false);
              return;
            }
          }
        }
      }

      console.log('[reminderPipeline] events.insert ok', {
        rowCount: Array.isArray(insertedRows) ? insertedRows.length : 0,
        ids: Array.isArray(insertedRows) ? insertedRows.map((r: { id?: string }) => r.id).filter(Boolean) : [],
      });

      // Kein Sofort-Push beim Anlegen: Erinnerungen laufen nur über notification_jobs + send-reminders
      // (In-App + Web-Push zum Reminder-Zeitpunkt). Manuelle Team-Pushes bleiben über Trainer-Team-Push.

      handleClose();
      await onSuccess();
    } catch (err) {
      console.error('[CreateEventModal] events.insert catch', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setCreating(false);
    }
  };

  const inputClass = EVENT_FORM_INPUT_CLASS;
  const labelClass = EVENT_FORM_LABEL_CLASS;

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
              setEventTypeLocal(
                e.target.value as 'game' | 'training' | 'event' | 'other' | 'tournament',
              )
            }
            className={inputClass}
          >
            <option value="game">Spiel</option>
            <option value="training">Training</option>
            <option value="tournament">Turnier</option>
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
        ) : eventTypeLocal === 'training' || eventTypeLocal === 'tournament' ? (
          <>
            <div>
              <label htmlFor="create-event-title" className={labelClass}>
                {eventTypeLocal === 'tournament' ? 'Turniername / Titel *' : 'Titel *'}
              </label>
              <input
                id="create-event-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder={
                  eventTypeLocal === 'tournament'
                    ? 'z. B. Frühjahrsturnier U12'
                    : 'z. B. Training, Hallentraining'
                }
              />
            </div>
            <div>
              <label htmlFor="create-event-end_time" className={labelClass}>
                Ende (optional)
              </label>
              <EventTimeField
                id="create-event-end_time"
                value={form.end_time}
                onChange={(v) => setForm((f) => ({ ...f, end_time: v }))}
                disabled={creating}
                label="Ende"
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
            {eventTypeLocal === 'training' ? (
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
            ) : null}
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
        <VenuePicker
          teamSeasonId={teamSeasonId}
          venueId={selectedVenue?.id ?? null}
          onVenueChange={(v) => {
            setSelectedVenue(v);
            setTrainingFacility({ fieldId: null, zoneId: null });
          }}
          locationName={form.location}
          locationAddress={form.location_address}
          onLocationNameChange={(v) => setForm((f) => ({ ...f, location: v }))}
          onLocationAddressChange={(v) => setForm((f) => ({ ...f, location_address: v }))}
          matchContext={
            eventTypeLocal === 'game'
              ? { isHome: form.is_home, opponentName: form.opponent }
              : null
          }
          purpose={
            eventTypeLocal === 'training'
              ? 'training'
              : eventTypeLocal === 'game' && form.is_home
                ? 'home_match'
                : 'general'
          }
          labelClass={labelClass}
          inputClass={inputClass}
          disabled={creating}
        />
        {eventTypeLocal === 'training' ? (
          <TrainingFacilityFields
            venueId={selectedVenue?.id ?? null}
            value={trainingFacility}
            onChange={setTrainingFacility}
            labelClass={labelClass}
            inputClass={inputClass}
            disabled={creating}
          />
        ) : null}
        <div>
          <label htmlFor="create-event-start_date" className={labelClass}>
            Datum *
          </label>
          <EventDateField
            id="create-event-start_date"
            required
            value={form.start_date}
            onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
            disabled={creating}
            aria-label="Datum"
          />
        </div>
        <div>
          <label htmlFor="create-event-start_time" className={labelClass}>
            Beginn *
          </label>
          <EventTimeField
            id="create-event-start_time"
            value={form.start_time}
            onChange={(v) => setForm((f) => ({ ...f, start_time: v }))}
            disabled={creating}
            label="Beginn"
          />
        </div>
        <div>
          <label htmlFor="create-event-meetup_time" className={labelClass}>
            Treffpunkt (optional)
          </label>
          <EventTimeField
            id="create-event-meetup_time"
            value={form.meetup_time}
            onChange={(v) => setForm((f) => ({ ...f, meetup_time: v }))}
            disabled={creating}
            label="Treffpunkt"
          />
        </div>
        {(eventTypeLocal === 'training' ||
          eventTypeLocal === 'tournament' ||
          eventTypeLocal === 'event' ||
          eventTypeLocal === 'other') && (
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
                <EventDateField
                  id="create-event-until"
                  value={form.until_date}
                  onChange={(v) => setForm((f) => ({ ...f, until_date: v }))}
                  disabled={creating}
                  aria-label="Wiederholen bis"
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
