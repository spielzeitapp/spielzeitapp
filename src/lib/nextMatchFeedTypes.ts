import { FEED_HASHTAG } from '../components/feed/feedTypography';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';
import type { MatchdayFeedPayload } from './matchdayFeedTypes';

export type NextMatchFeedPayload = MatchdayFeedPayload;

/** Payload-Parser (gleiche Struktur wie Matchday). */
export { parseMatchdayPayload as parseNextMatchFeedPayload } from './matchdayFeedTypes';

export function dedupeKeyForNextMatchEvent(eventId: string): string {
  return `next_match_feed:${eventId}`;
}

function formatNextMatchDateLine(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d);
}

function formatNextMatchTimeLine(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = getDateTimePartsInTimeZone(d, VIENNA_TZ);
  if (!parts) return '—';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} Uhr`;
}

export function buildAutoNextMatchCaption(params: {
  ourTeamName: string;
  opponentName: string;
  startsAtIso: string;
  location: string;
  address?: string;
}): string {
  const { ourTeamName, opponentName, startsAtIso, location, address } = params;
  const parsed = splitCombinedLocation(location);
  const place =
    (formatFullLocation(parsed.place, address || parsed.address || '') || '').trim() ||
    (location || '').trim() ||
    '—';

  return [
    '⚽ NÄCHSTES SPIEL',
    '',
    `${ourTeamName.trim()} trifft auf ${opponentName.trim()}.`,
    '',
    formatNextMatchDateLine(startsAtIso),
    formatNextMatchTimeLine(startsAtIso),
    '',
    place,
    '',
    FEED_HASHTAG,
  ].join('\n');
}
