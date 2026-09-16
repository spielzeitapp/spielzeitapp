export type SquadFeedPlayer = {
  player_id: string;
  name: string;
  jersey_number: number | null;
};

export type SquadFeedPayload = {
  match_id: string;
  event_id: string;
  team_season_id: string;
  our_team_name: string;
  opponent_name: string;
  is_home: boolean | null;
  starts_at: string | null;
  deep_link: string;
  players: SquadFeedPlayer[];
  version: number;
};

export function parseSquadFeedPayload(raw: unknown): SquadFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const matchId = typeof p.match_id === 'string' ? p.match_id.trim() : '';
  const eventId = typeof p.event_id === 'string' ? p.event_id.trim() : '';
  const teamSeasonId = typeof p.team_season_id === 'string' ? p.team_season_id.trim() : '';
  if (!matchId || !eventId || !teamSeasonId) return null;

  const players = Array.isArray(p.players)
    ? p.players.flatMap((item): SquadFeedPlayer[] => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const playerId = typeof row.player_id === 'string' ? row.player_id.trim() : '';
        if (!playerId) return [];
        const jersey = Number(row.jersey_number);
        return [{
          player_id: playerId,
          name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Spieler',
          jersey_number: Number.isFinite(jersey) && jersey > 0 ? Math.trunc(jersey) : null,
        }];
      })
    : [];

  return {
    match_id: matchId,
    event_id: eventId,
    team_season_id: teamSeasonId,
    our_team_name: typeof p.our_team_name === 'string' ? p.our_team_name.trim() : '',
    opponent_name: typeof p.opponent_name === 'string' ? p.opponent_name.trim() : '',
    is_home: typeof p.is_home === 'boolean' ? p.is_home : null,
    starts_at: typeof p.starts_at === 'string' ? p.starts_at : null,
    deep_link: typeof p.deep_link === 'string' ? p.deep_link : `/app/events/${eventId}`,
    players,
    version: Number.isFinite(Number(p.version)) ? Number(p.version) : 1,
  };
}
