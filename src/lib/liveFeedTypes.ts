import { FEED_HASHTAG } from '../components/feed/feedTypography';

export type LiveFeedPayload = {
  match_id: string;
  event_id: string;
  team_season_id: string;
  home_team_name: string;
  away_team_name: string;
  home_logo_url: string;
  away_logo_url: string;
  starts_at: string | null;
  location: string;
  match_type: string | null;
  status: 'live';
  deep_link: string;
};

export function dedupeKeyForLiveMatch(matchId: string): string {
  return `live_feed:${matchId}`;
}

export function parseLiveFeedPayload(raw: unknown): LiveFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const matchId = typeof p.match_id === 'string' ? p.match_id.trim() : '';
  const eventId = typeof p.event_id === 'string' ? p.event_id.trim() : '';
  if (!matchId || !eventId) return null;
  const home =
    (typeof p.home_team_name === 'string' && p.home_team_name.trim()) ||
    (typeof p.display_home_name === 'string' && p.display_home_name.trim()) ||
    '';
  const away =
    (typeof p.away_team_name === 'string' && p.away_team_name.trim()) ||
    (typeof p.display_away_name === 'string' && p.display_away_name.trim()) ||
    '';
  if (!home || !away) return null;
  const deep =
    typeof p.deep_link === 'string' && p.deep_link.trim()
      ? p.deep_link.trim()
      : `/app/live/${matchId}`;
  return {
    match_id: matchId,
    event_id: eventId,
    team_season_id: String(p.team_season_id ?? ''),
    home_team_name: home,
    away_team_name: away,
    home_logo_url: typeof p.home_logo_url === 'string' ? p.home_logo_url : '',
    away_logo_url: typeof p.away_logo_url === 'string' ? p.away_logo_url : '',
    starts_at:
      typeof p.starts_at === 'string'
        ? p.starts_at
        : typeof p.kickoff_iso === 'string'
          ? p.kickoff_iso
          : null,
    location: String(p.location ?? ''),
    match_type: typeof p.match_type === 'string' ? p.match_type : null,
    status: 'live',
    deep_link: deep,
  };
}

export function buildAutoLiveFeedCaption(homeTeamName: string, awayTeamName: string): string {
  const home = homeTeamName.trim() || 'Heim';
  const away = awayTeamName.trim() || 'Gast';
  return [
    '🔴 LIVE',
    `${home} vs ${away} läuft jetzt live.`,
    'Jetzt im Liveticker mitfiebern.',
    '',
    FEED_HASHTAG,
  ].join('\n');
}
