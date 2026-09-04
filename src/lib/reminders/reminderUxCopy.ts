import type { RawEventRow } from '../notifications/eventTypes';
import { formatEventDateVienna, formatEventTimeVienna } from '../notifications/format';

export type ReminderJobKindUi = 'match' | 'training' | 'event';

/** Deep-Link für Push + In-App (match → /app/match/:id wenn match_id gesetzt). */
export function reminderAppDeepLink(
  kind: ReminderJobKindUi,
  ev: Pick<RawEventRow, 'id' | 'match_id'>,
): string {
  if (kind === 'match' && ev.match_id) return `/app/match/${ev.match_id}`;
  if (kind === 'match') return `/app/events/${ev.id}`;
  return `/app/events/${ev.id}`;
}

/**
 * Kurze iPhone-ähnliche Titel/Zeil für In-App + Web-Push (keine „Erinnerung:“-Flut).
 */
export function buildReminderUxCopy(
  kind: ReminderJobKindUi,
  ev: Pick<RawEventRow, 'opponent' | 'starts_at' | 'meeting_at'>,
  reminderKey?: string | null,
): { title: string; message: string } {
  const meetOrStart =
    ev.meeting_at && String(ev.meeting_at).trim() ? ev.meeting_at : ev.starts_at;
  const timeStr = formatEventTimeVienna(meetOrStart);
  const dateStr = formatEventDateVienna(ev.starts_at);

  if (kind === 'match') {
    const opp = (ev.opponent ?? '').trim();
    const gegner = opp || 'Gegner';
    const title = `⚽ Spiel gegen ${gegner}`;
    const isSecond =
      reminderKey === 'match_reminder_2' ||
      reminderKey === 'match_second_reminder' ||
      (typeof reminderKey === 'string' && reminderKey.includes('second'));
    const message = isSecond
      ? `Deine Rückmeldung fehlt noch. Bitte jetzt verbindlich zu- oder absagen.`
      : `Bitte für das Spiel am ${dateStr || 'kommenden Termin'} um ${timeStr} Uhr zu- oder absagen.`;
    return { title, message };
  }

  if (kind === 'training') {
    return {
      title: 'Training',
      message: `Heute ${timeStr} – Treffpunkt nicht vergessen`,
    };
  }

  const startTime = formatEventTimeVienna(ev.starts_at);
  return {
    title: 'Termin',
    message: `${dateStr} ${startTime} – Treffpunkt nicht vergessen`,
  };
}
