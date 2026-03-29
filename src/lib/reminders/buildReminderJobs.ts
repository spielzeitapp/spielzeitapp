import { getCanonicalEventType, getEventDisplayTitle, type RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import type { NotificationKind } from '../notifications/pending';
import type { ReminderJobInsert, ReminderJobKind } from './types';

function toIso(d: Date): string {
  return d.toISOString();
}

function nonEmptyIso(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  const t = String(iso).trim();
  return t === '' ? null : t;
}

/**
 * Basiszeit für Reminder-Offset (Projektfelder: meetup_at / meeting_at, kickoff_at, starts_at).
 * MATCH: Treff → Kickoff → Start
 * TRAINING: Treff → Start
 * EVENT / other: starts_at
 */
export function getBaseTimeForEvent(event: RawEventRow): string {
  const meet = nonEmptyIso(event.meetup_at) ?? nonEmptyIso(event.meeting_at);
  const kickoff = nonEmptyIso(event.kickoff_at);
  const start = nonEmptyIso(event.starts_at) ?? '';
  const ctype = getCanonicalEventType(event);
  if (ctype === 'game') {
    if (meet) return meet;
    if (kickoff) return kickoff;
    return start;
  }
  if (ctype === 'training') {
    if (meet) return meet;
    return start;
  }
  return start;
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
    const m = safeMinutes(settings.training_minutes_before, 120);
    out.push({ offsetMinutes: m, reminderKey: `training_${m}`, notificationType: 'training_reminder' });
  }

  if (ctype === 'game') {
    if (settings.match_enabled) {
      const m = safeMinutes(settings.match_minutes_before, 1440);
      out.push({ offsetMinutes: m, reminderKey: `match_${m}`, notificationType: 'game_reminder' });
    }
    if (settings.match_second_enabled) {
      const m = safeMinutes(settings.match_second_minutes_before, 120);
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
  if ((event.status ?? 'upcoming') !== 'upcoming') {
    return [];
  }

  const baseIso = getBaseTimeForEvent(event);
  const baseMs = new Date(baseIso).getTime();
  if (Number.isNaN(baseMs)) return [];

  const nowMs = now.getTime();
  if (baseMs <= nowMs) {
    return [];
  }

  const ctype = getCanonicalEventType(event);
  const kind = jobKindForCanonical(ctype);
  const slots = getOffsetsForEvent(event, settings);
  const out: ReminderJobInsert[] = [];
  const eventTitle = getEventDisplayTitle(event);
  const eventTypeLabel =
    ctype === 'game' ? 'match' : ctype === 'training' ? 'training' : ctype === 'event' ? 'event' : 'other';

  for (const slot of slots) {
    const idealSendAtMs = baseMs - slot.offsetMinutes * 60 * 1000;
    let sendAtMs = idealSendAtMs;
    let clamped = false;
    if (sendAtMs <= nowMs) {
      sendAtMs = nowMs + CLAMP_SOON_MS;
      clamped = true;
    }

    const payload = {
      reminderKey: slot.reminderKey,
      reminder_type: slot.reminderKey,
      offsetMinutes: slot.offsetMinutes,
      minutes_before: slot.offsetMinutes,
      notificationType: slot.notificationType,
      baseTimeIso: baseIso,
      clamped,
      event_id: event.id,
      team_id: teamId,
      event_title: eventTitle,
      event_type: eventTypeLabel,
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
