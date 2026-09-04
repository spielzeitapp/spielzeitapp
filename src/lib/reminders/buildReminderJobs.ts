/**
 * Reminder-Jobs: `send_at` und `payload.baseTimeIso` sind **UTC** (ISO 8601, DB timestamptz).
 *
 * Nutzer geben Zeiten in Europe/Vienna ein; Speicherung ist UTC. Reminder-Offsets werden von
 * dieser UTC-Basis abgezogen — **keine** Umrechnung über lokale Datumsstrings, nur Instants (ms).
 *
 * Basiszeit für Offsets (`getReminderBaseTimeMeta`):
 * - **Spiel**: `kickoff_at` falls gesetzt, sonst `starts_at`. `meeting_at` ist **kein** Reminder-Anker.
 * - **Training**: `starts_at`, sonst Fallback `meeting_at`.
 * - **Event / other**: `starts_at`.
 */
import { getCanonicalEventType, getEventDisplayTitle, type RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import type { NotificationKind } from '../notifications/pending';
import type { ReminderJobInsert, ReminderJobKind } from './types';
import { getViennaCutoffDate } from '../viennaTime';

const VIENNA_TZ_DEBUG = 'Europe/Vienna';

function toIso(d: Date): string {
  return d.toISOString();
}

function nonEmptyIso(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  const t = String(iso).trim();
  return t === '' ? null : t;
}

/** Nur für Logs: UTC-ISO → lesbare Vienna-Zeit (nicht als Rechenbasis). */
export function formatUtcIsoAsViennaDebug(isoUtc: string | null | undefined): string {
  const s = (isoUtc ?? '').trim();
  if (!s) return '(leer)';
  const ms = parseUtcInstantMs(s);
  if (Number.isNaN(ms)) return `(ungültig: ${isoUtc})`;
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ_DEBUG,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms));
}

/**
 * UTC-Instant (ms) aus DB-ISO. timestamptz kommt meist mit Offset/Z; ohne Offset wird **UTC** angenommen
 * (kein `Date`-Parsing lokaler Strings ohne Z, das je nach Engine falsch wäre).
 */
export function parseUtcInstantMs(iso: string): number {
  let t = String(iso).trim();
  if (!t) return NaN;
  if (/^\d{4}-\d{2}-\d{2} \d/.test(t)) {
    t = t.replace(' ', 'T');
  }
  const hasTz = /[zZ]\s*$|[+-]\d{2}:\d{2}(?::\d{2})?\s*$/.test(t);
  const normalized = hasTz ? t : `${t}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export type ReminderBaseTimeReason =
  | 'game_kickoff'
  | 'game_starts'
  | 'training_starts'
  | 'training_meeting_fallback'
  | 'event_starts';

/**
 * Basis-Instant und Herkunft für Reminder-Offsets (alles aus gespeicherten UTC-Strings).
 */
export function getReminderBaseTimeMeta(event: RawEventRow): { baseIso: string; reason: ReminderBaseTimeReason } {
  const meet = nonEmptyIso(event.meeting_at);
  const kickoff = nonEmptyIso(event.kickoff_at);
  const start = nonEmptyIso(event.starts_at) ?? '';
  const ctype = getCanonicalEventType(event);
  if (ctype === 'game') {
    if (kickoff) return { baseIso: kickoff, reason: 'game_kickoff' };
    return { baseIso: start, reason: 'game_starts' };
  }
  if (ctype === 'training') {
    if (start) return { baseIso: start, reason: 'training_starts' };
    if (meet) return { baseIso: meet, reason: 'training_meeting_fallback' };
    return { baseIso: start, reason: 'training_starts' };
  }
  return { baseIso: start, reason: 'event_starts' };
}

/** Liefert nur die Basis-ISO; für Ursache siehe `getReminderBaseTimeMeta`. */
export function getBaseTimeForEvent(event: RawEventRow): string {
  return getReminderBaseTimeMeta(event).baseIso;
}

export type OffsetSlot = {
  offsetMinutes: number;
  reminderKey: string;
  notificationType: NotificationKind;
};

/**
 * Aktive Reminder-Offsets aus team_notification_settings (bereits normalisiert).
 */
function safeMinutes(n: number, fallback: number): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function getOffsetsForEvent(
  event: RawEventRow,
  settings: TeamNotificationSettingsRow,
): OffsetSlot[] {
  const ctype = getCanonicalEventType(event);
  const out: OffsetSlot[] = [];

  if (ctype === 'training' && settings.training_enabled) {
    out.push({ offsetMinutes: 0, reminderKey: 'training_day_1100', notificationType: 'training_reminder' });
  }

  if (ctype === 'game') {
    if (settings.match_enabled) {
      const m = safeMinutes(settings.match_minutes_before, 2880);
      out.push({ offsetMinutes: m, reminderKey: `match_${m}`, notificationType: 'game_reminder' });
    }
    if (settings.match_second_enabled) {
      const m = safeMinutes(settings.match_second_minutes_before, 1440);
      out.push({
        offsetMinutes: m,
        reminderKey: `match_second_${m}`,
        notificationType: 'game_second_reminder',
      });
    }
  }

  if ((ctype === 'event' || ctype === 'other') && settings.event_enabled) {
    const m = safeMinutes(settings.event_minutes_before, 1440);
    out.push({ offsetMinutes: m, reminderKey: `event_${m}`, notificationType: 'event_reminder' });
  }

  return out;
}

function jobKindForCanonical(ctype: ReturnType<typeof getCanonicalEventType>): ReminderJobKind {
  if (ctype === 'game') return 'match';
  if (ctype === 'training') return 'training';
  return 'event';
}

/** Stabil: event:<uuid>:match_reminder_1 */
function buildDedupeKey(eventId: string, semanticReminderKey: string): string {
  return `event:${eventId}:${semanticReminderKey}`;
}

/** Mindest-Abstand in die Zukunft, wenn der ideale send_at schon vorbei ist (Termin steht noch bevor). */
const CLAMP_SOON_MS = 120_000;

/**
 * Erzeugt Jobs mit send_at in der Zukunft. Liegt der ideale Zeitpunkt (base − offset) schon in der
 * Vergangenheit, der Termin aber noch in der Zukunft, wird send_at auf „bald“ geklemmt — sonst
 * entstünden bei z. B. 24h-Reminder vor morgen oft 0 Jobs.
 */
export function buildReminderJobsForEvent(
  event: RawEventRow & { id: string },
  settings: TeamNotificationSettingsRow,
  teamId: string,
  now: Date = new Date(),
): ReminderJobInsert[] {
  const { baseIso, reason: baseReason } = getReminderBaseTimeMeta(event);
  const startsRaw = (event as RawEventRow).starts_at;
  const meetingRaw = (event as RawEventRow).meeting_at;
  const kickoffRaw = (event as RawEventRow).kickoff_at;

  if ((event.status ?? 'upcoming') !== 'upcoming') {
    console.log('[reminderTz] skip jobs: event not upcoming', {
      eventId: event.id,
      status: event.status,
      starts_at_utc: startsRaw,
      meeting_at_utc: meetingRaw,
      kickoff_at_utc: kickoffRaw ?? null,
    });
    return [];
  }

  const baseMs = parseUtcInstantMs(baseIso);
  if (Number.isNaN(baseMs)) {
    console.log('[reminderTz] skip jobs: base time unparseable', {
      eventId: event.id,
      baseIso,
      baseReason,
      starts_at_utc: startsRaw,
      meeting_at_utc: meetingRaw,
      kickoff_at_utc: kickoffRaw ?? null,
    });
    return [];
  }

  const nowMs = now.getTime();
  if (baseMs <= nowMs) {
    console.log('[reminderTz] skip jobs: base instant in the past (UTC)', {
      eventId: event.id,
      baseTimeUtc: baseIso,
      baseReason,
      baseViennaDebug: formatUtcIsoAsViennaDebug(baseIso),
      nowUtc: toIso(now),
      nowViennaDebug: formatUtcIsoAsViennaDebug(toIso(now)),
      starts_at_utc: startsRaw,
      meeting_at_utc: meetingRaw,
      kickoff_at_utc: kickoffRaw ?? null,
    });
    return [];
  }

  const ctype = getCanonicalEventType(event);
  const kind = jobKindForCanonical(ctype);
  const slots = getOffsetsForEvent(event, settings);
  const out: ReminderJobInsert[] = [];
  const eventTitle = getEventDisplayTitle(event);
  const eventTypeLabel =
    ctype === 'game' ? 'match' : ctype === 'training' ? 'training' : ctype === 'event' ? 'event' : 'other';

  console.log('[reminderTz] build jobs (UTC math)', {
    eventId: event.id,
    canonicalType: ctype,
    baseTimeUtc: baseIso,
    baseReason,
    baseViennaDebug: formatUtcIsoAsViennaDebug(baseIso),
    starts_at_utc: startsRaw,
    meeting_at_utc: meetingRaw,
    kickoff_at_utc: kickoffRaw ?? null,
    startsViennaDebug: formatUtcIsoAsViennaDebug(startsRaw),
    meetingViennaDebug: meetingRaw ? formatUtcIsoAsViennaDebug(meetingRaw) : null,
    nowUtc: toIso(now),
    nowViennaDebug: formatUtcIsoAsViennaDebug(toIso(now)),
    slotCount: slots.length,
  });

  if (slots.length === 0) {
    console.log('[reminderTz] skip jobs: no reminder offsets (type/settings)', { eventId: event.id, ctype });
    return [];
  }

  for (const slot of slots) {
    const trainingAtEleven = ctype === 'training' ? getViennaCutoffDate(baseIso, 11, 0) : null;
    const idealSendAtMs = trainingAtEleven
      ? trainingAtEleven.getTime()
      : baseMs - slot.offsetMinutes * 60 * 1000;
    let sendAtMs = idealSendAtMs;
    let clamped = false;
    if (sendAtMs <= nowMs) {
      sendAtMs = nowMs + CLAMP_SOON_MS;
      clamped = true;
    }

    const sendAtIso = toIso(new Date(sendAtMs));
    console.log('[reminderTz] slot → scheduled send_at (UTC)', {
      eventId: event.id,
      reminderKey: slot.reminderKey,
      offsetMinutes: slot.offsetMinutes,
      idealSendAtUtc: toIso(new Date(idealSendAtMs)),
      idealSendAtViennaDebug: formatUtcIsoAsViennaDebug(toIso(new Date(idealSendAtMs))),
      sendAtUtc: sendAtIso,
      sendAtViennaDebug: formatUtcIsoAsViennaDebug(sendAtIso),
      clamped,
    });

    const payload = {
      reminderKey: slot.reminderKey,
      reminder_type: slot.reminderKey,
      offsetMinutes: slot.offsetMinutes,
      minutes_before: slot.offsetMinutes,
      notificationType: slot.notificationType,
      baseTimeIso: baseIso,
      baseReason,
      clamped,
      event_id: event.id,
      team_id: teamId,
      event_title: eventTitle,
      type: eventTypeLabel,
    };

    out.push({
      event_id: event.id,
      team_id: teamId,
      kind,
      send_at: toIso(new Date(sendAtMs)),
      payload,
      status: 'pending',
      dedupe_key: buildDedupeKey(event.id, slot.reminderKey),
    });
  }

  return out;
}
