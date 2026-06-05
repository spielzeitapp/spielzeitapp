import { FEED_HASHTAG } from '../components/feed/feedTypography';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';

export type LineupFeedPlayer = {
  player_id: string;
  name: string;
  slot?: string;
};

export type LineupFeedPayload = {
  match_id: string;
  event_id: string;
  team_season_id: string;
  formation: string | null;
  lineup_players: LineupFeedPlayer[];
  starts_at?: string | null;
  deep_link?: string;
};

export function dedupeKeyForLineupMatch(matchId: string): string {
  return `lineup_feed:${matchId.trim()}`;
}

export function parseLineupFeedPayload(raw: unknown): LineupFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const matchId = typeof p.match_id === 'string' ? p.match_id.trim() : '';
  const eventId = typeof p.event_id === 'string' ? p.event_id.trim() : '';
  const teamSeasonId = typeof p.team_season_id === 'string' ? p.team_season_id.trim() : '';
  if (!matchId || !eventId || !teamSeasonId) return null;

  const rawPlayers = p.lineup_players;
  const lineup_players: LineupFeedPlayer[] = [];
  if (Array.isArray(rawPlayers)) {
    for (const item of rawPlayers) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const player_id = typeof row.player_id === 'string' ? row.player_id.trim() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!player_id) continue;
      lineup_players.push({
        player_id,
        name,
        slot: typeof row.slot === 'string' ? row.slot : undefined,
      });
    }
  }

  const formationRaw = p.formation;
  const formation =
    formationRaw == null || formationRaw === ''
      ? null
      : typeof formationRaw === 'string'
        ? formationRaw.trim() || null
        : String(formationRaw).trim() || null;

  return {
    match_id: matchId,
    event_id: eventId,
    team_season_id: teamSeasonId,
    formation,
    lineup_players,
    starts_at: typeof p.starts_at === 'string' ? p.starts_at : null,
    deep_link: typeof p.deep_link === 'string' ? p.deep_link : undefined,
  };
}

function formatLineupKickoffTimeLine(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = getDateTimePartsInTimeZone(d, VIENNA_TZ);
  if (!parts) return '—';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} Uhr`;
}

export function buildAutoLineupFeedCaption(params: {
  formation: string | null;
  startsAtIso: string;
}): string {
  const lines = ['📋 STARTAUFSTELLUNG', '', 'Unsere Mannschaft ist bereit.', ''];
  if (params.formation?.trim()) {
    lines.push(`Formation: ${params.formation.trim()}`, '');
  }
  lines.push(`⚽ Heute ${formatLineupKickoffTimeLine(params.startsAtIso)}`, '', FEED_HASHTAG);
  return lines.join('\n');
}
