import type { EventRow } from '../hooks/useEvents';
import { formatEventDateLongVienna, formatEventTimeVienna } from './notifications/format';

export type MatchFeedCaptionKind = 'matchday' | 'squad' | 'lineup';

type MatchFeedEvent = Pick<EventRow, 'opponent' | 'is_home' | 'starts_at' | 'location'>;

const FEED_HASHTAG = '#GEMEINSAMEINTEAM';

function matchDescription(event: MatchFeedEvent): string {
  const opponent = (event.opponent ?? '').trim();
  if (event.is_home === true) return opponent ? `Heimspiel gegen ${opponent}` : 'Heimspiel';
  if (event.is_home === false) return opponent ? `Auswärtsspiel bei ${opponent}` : 'Auswärtsspiel';
  return opponent ? `Spiel gegen ${opponent}` : 'nächste Spiel';
}

function lineupMatchDescription(event: MatchFeedEvent): string {
  const opponent = (event.opponent ?? '').trim();
  if (event.is_home === true) return opponent ? `ins Heimspiel gegen ${opponent}` : 'ins Heimspiel';
  if (event.is_home === false) return opponent ? `ins Auswärtsspiel bei ${opponent}` : 'ins Auswärtsspiel';
  return opponent ? `ins Spiel gegen ${opponent}` : 'ins nächste Spiel';
}

function matchDetails(event: MatchFeedEvent): string[] {
  const lines = [
    `📅 ${formatEventDateLongVienna(event.starts_at)}`,
    `⏰ ${formatEventTimeVienna(event.starts_at)} Uhr`,
  ];
  const location = (event.location ?? '').trim();
  if (location) lines.push(`📍 ${location}`);
  return lines;
}

/** Bearbeitbarer Vorschlag für die drei Match-Feed-Beiträge. */
export function buildMatchFeedCaptionDraft(kind: MatchFeedCaptionKind, event: MatchFeedEvent): string {
  const description = matchDescription(event);
  const details = matchDetails(event);

  if (kind === 'squad') {
    return [
      '📋 KADER',
      '',
      `Unser Kader für das ${description} steht fest.`,
      '',
      ...details,
      '',
      FEED_HASHTAG,
    ].join('\n');
  }

  if (kind === 'lineup') {
    return [
      '🔥 Unsere Aufstellung steht!',
      '',
      `Mit dieser Startelf geht unser Team ${lineupMatchDescription(event)}.`,
      '',
      ...details,
      '',
      "Auf geht’s, Team!",
      '',
      FEED_HASHTAG,
    ].join('\n');
  }

  return [
    '⚽ SPIELTAG',
    '',
    description === 'nächste Spiel' ? 'Unser nächstes Spiel' : description,
    '',
    ...details,
    '',
    FEED_HASHTAG,
  ].join('\n');
}
