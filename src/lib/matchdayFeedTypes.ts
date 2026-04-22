export type MatchdayFeedPayload = {
  display_home_name: string;
  display_away_name: string;
  our_team_name: string;
  is_home: boolean;
  opponent_logo_url: string | null;
  match_type: string | null;
  kickoff_iso: string;
  meeting_iso: string | null;
  location: string;
  address?: string;
  match_id: string | null;
  event_id: string;
  deep_link: string;
};

export type TeamFeedPostRow = {
  id: string;
  team_season_id: string;
  team_id: string;
  event_id: string;
  post_kind: string;
  caption: string;
  payload: MatchdayFeedPayload;
  created_at: string;
};

export function parseMatchdayPayload(raw: unknown): MatchdayFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const kickoff = typeof p.kickoff_iso === 'string' ? p.kickoff_iso : '';
  const eventId = typeof p.event_id === 'string' ? p.event_id : '';
  if (!kickoff || !eventId) return null;
  return {
    display_home_name: String(p.display_home_name ?? ''),
    display_away_name: String(p.display_away_name ?? ''),
    our_team_name: String(p.our_team_name ?? ''),
    is_home: Boolean(p.is_home),
    opponent_logo_url: typeof p.opponent_logo_url === 'string' ? p.opponent_logo_url : null,
    match_type: typeof p.match_type === 'string' ? p.match_type : null,
    kickoff_iso: kickoff,
    meeting_iso: typeof p.meeting_iso === 'string' ? p.meeting_iso : null,
    location: String(p.location ?? ''),
    address: typeof p.address === 'string' ? p.address : undefined,
    match_id: typeof p.match_id === 'string' ? p.match_id : null,
    event_id: eventId,
    deep_link: typeof p.deep_link === 'string' ? p.deep_link : `/app/events/${eventId}`,
  };
}
