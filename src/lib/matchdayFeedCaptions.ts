import { FEED_HASHTAG } from '../components/feed/feedTypography';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';

function formatKickoffLine(startsAtIso: string): string | null {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = getDateTimePartsInTimeZone(d, VIENNA_TZ);
  if (!parts) return null;
  return `Anpfiff: ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} Uhr`;
}

function formatLocationLine(location: string, address?: string): string | null {
  const parsed = splitCombinedLocation(location);
  const line =
    (formatFullLocation(parsed.place, address || parsed.address || '') || '').trim() ||
    (location || '').trim();
  return line ? `Ort: ${line}` : null;
}

export function buildMatchdayTodayCaption(params: {
  ourTeamName: string;
  opponentName: string;
  startsAtIso: string;
  location: string;
  address?: string;
}): string {
  const { ourTeamName, opponentName, startsAtIso, location, address } = params;
  const lines = [
    '🔥 HEUTE IST SPIELTAG',
    `${ourTeamName.trim()} trifft heute auf ${opponentName.trim()}.`,
  ];
  const kick = formatKickoffLine(startsAtIso);
  if (kick) lines.push(kick);
  const ort = formatLocationLine(location, address);
  if (ort) lines.push(ort);
  lines.push('', FEED_HASHTAG);
  return lines.join('\n');
}

export function buildMatchdayTomorrowCaption(params: {
  opponentName: string;
  startsAtIso: string;
  location: string;
  address?: string;
}): string {
  const { opponentName, startsAtIso, location, address } = params;
  const lines = [
    '🔥 MORGEN IST SPIELTAG',
    `Morgen wartet das Spiel gegen ${opponentName.trim()}.`,
  ];
  const kick = formatKickoffLine(startsAtIso);
  if (kick) lines.push(kick);
  const ort = formatLocationLine(location, address);
  if (ort) lines.push(ort);
  lines.push('', FEED_HASHTAG);
  return lines.join('\n');
}

export function dedupeKeyMatchdayToday(eventId: string): string {
  return `matchday_today:${eventId}`;
}

export function dedupeKeyMatchdayTomorrow(eventId: string): string {
  return `matchday_tomorrow:${eventId}`;
}
