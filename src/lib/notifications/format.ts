import { VIENNA_TZ } from '../viennaTime';

export function formatEventTimeVienna(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatEventDateVienna(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function formatEventDateLongVienna(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: VIENNA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function buildTrainingReminderBody(title: string, startsAtIso: string): string {
  const t = formatEventTimeVienna(startsAtIso);
  return `${title} um ${t}. Bitte bis 12:00 absagen, falls ihr fehlt.`;
}

export function buildGameReminderBody(title: string, startsAtIso: string): string {
  const d = formatEventDateVienna(startsAtIso);
  return `${title} am ${d}. Bitte Zu- oder Absage abgeben.`;
}

/** In-App Reminder-Body mit Datum, Uhrzeit, optional Ort/Treffpunkt */
export function buildReminderInAppBody(
  titleStr: string,
  startsAtIso: string,
  location?: string | null,
  meetupAtIso?: string | null,
): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) {
    return `Bitte gib noch deine Zu- oder Absage für '${titleStr || 'Termin'}' ab.`;
  }
  const dateStr = new Intl.DateTimeFormat('de-DE', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const timeStr = new Intl.DateTimeFormat('de-DE', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  let body = `Bitte gib noch deine Zu- oder Absage für '${titleStr || 'Termin'}' am ${dateStr} um ${timeStr} ab.`;
  const ort = (location ?? '').trim();
  if (ort) body += ` Ort: ${ort}.`;
  if (meetupAtIso) {
    const mu = new Date(meetupAtIso);
    if (!Number.isNaN(mu.getTime())) {
      body += ` Treffpunkt: ${new Intl.DateTimeFormat('de-DE', {
        timeZone: VIENNA_TZ,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(mu)}.`;
    }
  }
  return body;
}

export function buildPushReminderShort(eventTitle: string): string {
  const t = (eventTitle ?? '').trim() || 'den Termin';
  return `Bitte gib noch deine Zu-/Absage für ${t} ab.`;
}

/** Einheitliche Anzeige für Nachrichten-Listen / Home (Datum+Zeit in Vienna). */
export function formatDateTimeDeVienna(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Wie bisherige `toLocaleString` mit dateStyle/timeStyle – fest Europe/Vienna. */
export function formatDateTimeMediumDeVienna(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: VIENNA_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/** Listen-Timestamp: Heute/Gestern/kurzes Datum + Uhrzeit (Europe/Vienna). */
export function formatRelativeNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  const now = new Date();
  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(x);
  const dk = dayKey(d);
  const dkNow = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const dkYest = dayKey(y);
  const hm = new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  if (dk === dkNow) return `Heute, ${hm}`;
  if (dk === dkYest) return `Gestern, ${hm}`;
  const shortDate = new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  return `${shortDate}, ${hm}`;
}
