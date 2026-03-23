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
  const dateStr = d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  let body = `Bitte gib noch deine Zu- oder Absage für '${titleStr || 'Termin'}' am ${dateStr} um ${timeStr} ab.`;
  const ort = (location ?? '').trim();
  if (ort) body += ` Ort: ${ort}.`;
  if (meetupAtIso) {
    const mu = new Date(meetupAtIso);
    if (!Number.isNaN(mu.getTime())) {
      body += ` Treffpunkt: ${mu.toLocaleString('de-DE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}.`;
    }
  }
  return body;
}

export function buildPushReminderShort(eventTitle: string): string {
  const t = (eventTitle ?? '').trim() || 'den Termin';
  return `Bitte gib noch deine Zu-/Absage für ${t} ab.`;
}
