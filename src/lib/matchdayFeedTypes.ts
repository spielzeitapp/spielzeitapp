import { parseLiveFeedPayload, type LiveFeedPayload } from './liveFeedTypes';
import { parseLineupFeedPayload, type LineupFeedPayload } from './lineupFeedTypes';
import { parseResultFeedPayload, type ResultFeedPayload } from './resultFeedTypes';
import type { NextMatchFeedPayload } from './nextMatchFeedTypes';

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
  /** Feed-Ankündigung: heute / morgen (optional, Legacy ohne Feld). */
  matchday_timing?: 'today' | 'tomorrow';
  /** Beim Erstellen fixiertes Spielermotiv; alte Posts bleiben ohne diese Felder kompatibel. */
  matchday_player_id?: string | null;
  matchday_player_image_url?: string | null;
  matchday_player_name?: string | null;
  matchday_motif_source?: 'event_override' | 'roster_rotation';
};

/** Rohzeile aus Supabase (inkl. optionaler Medien-Felder). */
export type TeamFeedPostDbRow = {
  id: string;
  team_season_id: string;
  team_id: string;
  event_id: string | null;
  post_kind: string;
  caption: string;
  payload: unknown;
  created_at: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_by?: string | null;
  updated_at?: string | null;
  /** Optionaler externer http(s)-CTA (LIVE-FEED.1). */
  cta_url?: string | null;
  cta_label?: string | null;
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
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
};

export type ResultFeedPostRow = Omit<TeamFeedPostDbRow, 'payload'> & { payload: ResultFeedPayload };

export type NextMatchFeedPostRow = Omit<TeamFeedPostDbRow, 'payload'> & {
  payload: NextMatchFeedPayload & { home_logo_url?: string; away_logo_url?: string };
};

export type LiveFeedPostRow = Omit<TeamFeedPostDbRow, 'payload'> & { payload: LiveFeedPayload };

export type LineupFeedPostRow = Omit<TeamFeedPostDbRow, 'payload'> & { payload: LineupFeedPayload };

export type ClassifiedFeedPost =
  | { kind: 'matchday'; post: TeamFeedPostRow }
  | { kind: 'next_match'; post: NextMatchFeedPostRow }
  | { kind: 'live'; post: LiveFeedPostRow }
  | { kind: 'lineup'; post: LineupFeedPostRow }
  | { kind: 'image'; post: TeamFeedPostDbRow }
  | { kind: 'video'; post: TeamFeedPostDbRow }
  | { kind: 'result'; post: ResultFeedPostRow }
  | { kind: 'tournament_completion'; post: TeamFeedPostDbRow }
  | { kind: 'championship_schedule'; post: TeamFeedPostDbRow }
  | { kind: 'championship_match_changed'; post: TeamFeedPostDbRow };

export function classifyTeamFeedPost(row: TeamFeedPostDbRow): ClassifiedFeedPost | null {
  const mt = (row.media_type ?? '').toLowerCase().trim();
  const pk = (row.post_kind ?? '').toLowerCase().trim();
  if (mt === 'video' && row.media_url) {
    return { kind: 'video', post: row };
  }
  if (mt === 'image' && row.media_url) {
    return { kind: 'image', post: row };
  }
  if (mt === 'championship_schedule' || pk === 'championship_schedule_published') {
    return { kind: 'championship_schedule', post: row };
  }
  if (mt === 'championship_match_changed' || pk === 'championship_match_changed') {
    return { kind: 'championship_match_changed', post: row };
  }
  if (mt === 'live' || pk === 'live_auto') {
    const lpl = parseLiveFeedPayload(row.payload);
    if (!lpl) return null;
    return { kind: 'live', post: { ...row, payload: lpl } };
  }
  if (mt === 'result' || pk === 'result_auto') {
    const rpl = parseResultFeedPayload(row.payload);
    if (!rpl) return null;
    return { kind: 'result', post: { ...row, payload: rpl } };
  }
  if (mt === 'tournament_completion' || pk === 'tournament_completion_manual') {
    return { kind: 'tournament_completion', post: row };
  }
  if (mt === 'lineup' || pk === 'lineup_auto') {
    const lpl = parseLineupFeedPayload(row.payload);
    if (!lpl) return null;
    return { kind: 'lineup', post: { ...row, payload: lpl } };
  }
  if (mt === 'next_match' || pk === 'next_match_auto') {
    const npl = parseMatchdayPayload(row.payload);
    if (!npl) return null;
    const raw = row.payload as Record<string, unknown>;
    return {
      kind: 'next_match',
      post: {
        ...row,
        payload: {
          ...npl,
          home_logo_url: typeof raw.home_logo_url === 'string' ? raw.home_logo_url : undefined,
          away_logo_url: typeof raw.away_logo_url === 'string' ? raw.away_logo_url : undefined,
        },
      },
    };
  }
  const pl = parseMatchdayPayload(row.payload);
  if (!pl) return null;
  const eventId = row.event_id ?? pl.event_id;
  return {
    kind: 'matchday',
    post: {
      id: row.id,
      team_season_id: row.team_season_id,
      team_id: row.team_id,
      event_id: eventId,
      post_kind: row.post_kind,
      caption: row.caption,
      payload: pl,
      created_at: row.created_at,
      media_type: row.media_type,
      media_url: row.media_url,
      thumbnail_url: row.thumbnail_url,
      duration_seconds: row.duration_seconds,
    },
  };
}

export function parseMatchdayPayload(raw: unknown): MatchdayFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const kickoffRaw = p.kickoff_iso;
  const kickoff = typeof kickoffRaw === 'string' ? kickoffRaw : kickoffRaw != null ? String(kickoffRaw) : '';
  const eventRaw = p.event_id;
  const eventId = typeof eventRaw === 'string' ? eventRaw : eventRaw != null ? String(eventRaw) : '';
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
    matchday_timing:
      p.matchday_timing === 'today' || p.matchday_timing === 'tomorrow' ? p.matchday_timing : undefined,
    matchday_player_id:
      typeof p.matchday_player_id === 'string' ? p.matchday_player_id : null,
    matchday_player_image_url:
      typeof p.matchday_player_image_url === 'string' ? p.matchday_player_image_url : null,
    matchday_player_name:
      typeof p.matchday_player_name === 'string' ? p.matchday_player_name : null,
    matchday_motif_source:
      p.matchday_motif_source === 'event_override' || p.matchday_motif_source === 'roster_rotation'
        ? p.matchday_motif_source
        : undefined,
  };
}
