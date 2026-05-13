import { parseResultFeedPayload, type ResultFeedPayload } from './resultFeedTypes';

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

export type ClassifiedFeedPost =
  | { kind: 'matchday'; post: TeamFeedPostRow }
  | { kind: 'image'; post: TeamFeedPostDbRow }
  | { kind: 'video'; post: TeamFeedPostDbRow }
  | { kind: 'result'; post: ResultFeedPostRow };

export function classifyTeamFeedPost(row: TeamFeedPostDbRow): ClassifiedFeedPost | null {
  const mt = (row.media_type ?? '').toLowerCase().trim();
  const pk = (row.post_kind ?? '').toLowerCase().trim();
  if (mt === 'video' && row.media_url) {
    return { kind: 'video', post: row };
  }
  if (mt === 'image' && row.media_url) {
    return { kind: 'image', post: row };
  }
  if (mt === 'result' || pk === 'result_auto') {
    const rpl = parseResultFeedPayload(row.payload);
    if (!rpl) return null;
    return { kind: 'result', post: { ...row, payload: rpl } };
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
  };
}
