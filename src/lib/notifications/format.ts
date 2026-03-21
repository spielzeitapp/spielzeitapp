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
