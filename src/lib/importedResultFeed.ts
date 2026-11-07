import { supabase } from './supabaseClient';
import type { TeamFeedPostDbRow } from './matchdayFeedTypes';
import { getClubLogo } from './teamLogos';
import { scheduleClubName } from './scheduleClubIdentity';

type ImportedResult = {
  id: string; team_season_id: string; match_id: string; starts_at: string; is_home: boolean | null;
  opponent: string | null; opponent_logo_url: string | null; location: string | null; match_type: string | null;
  matches: { status: string; score_home: number | null; score_away: number | null } | null;
};
type Setting = { event_id: string; feed_automation_enabled: boolean | null; result_feed_enabled: boolean | null };

/** Read-only result cards: importing an official score does not require a fan to publish a post. */
export function buildImportedResultFeedRows(events: ImportedResult[], existing: TeamFeedPostDbRow[],
  settings: Setting[], suppressed: string[], team: { id: string; name: string }, now = Date.now()): TeamFeedPostDbRow[] {
  const posted = new Set(existing.filter(p => p.post_kind === 'result_auto' || p.media_type === 'result')
    .map(p => (p.payload as { match_id?: string } | null)?.match_id).filter(Boolean));
  const postedEvents = new Set(existing.filter(p => p.post_kind === 'result_auto' || p.media_type === 'result').map(p => p.event_id));
  const hidden = new Set(suppressed);
  const result: TeamFeedPostDbRow[] = [];
  for (const e of events) {
    const m = e.matches, setting = settings.find(s => s.event_id === e.id);
    if (!m || m.status !== 'finished' || typeof e.is_home !== 'boolean' || !e.starts_at || !Number.isFinite(Date.parse(e.starts_at)) || Date.parse(e.starts_at) > now) continue;
    if (m.score_home == null || m.score_away == null || !Number.isInteger(m.score_home) || !Number.isInteger(m.score_away) || m.score_home < 0 || m.score_away < 0) continue;
    if (posted.has(e.match_id) || postedEvents.has(e.id) || hidden.has(`result_feed:${e.match_id}`) || setting?.feed_automation_enabled === false || setting?.result_feed_enabled === false) continue;
    const own = scheduleClubName(team.name), opp = e.opponent || 'Gegner';
    const ourScore = e.is_home ? m.score_home : m.score_away, oppScore = e.is_home ? m.score_away : m.score_home;
    result.push({ id: `oefb-result:${e.match_id}`, team_season_id: e.team_season_id, team_id: team.id, event_id: e.id,
      post_kind: 'result_auto', caption: 'ÖFB · Importiertes Endergebnis', created_at: e.starts_at,
      media_type: 'result', media_url: null, thumbnail_url: null, duration_seconds: null, created_by: null,
      payload: { match_id: e.match_id, event_id: e.id, team_season_id: e.team_season_id,
        home_team_name: e.is_home ? own : opp, away_team_name: e.is_home ? opp : own,
        home_logo_url: getClubLogo(e.is_home ? own : opp, { logoUrl: e.is_home ? null : e.opponent_logo_url }),
        away_logo_url: getClubLogo(e.is_home ? opp : own, { logoUrl: e.is_home ? e.opponent_logo_url : null }),
        home_score: m.score_home, away_score: m.score_away, match_type: e.match_type,
        starts_at: e.starts_at, meeting_at: null, location: e.location || '', scorers: [], period_scores: null,
        result_state: ourScore > oppScore ? 'win' : ourScore < oppScore ? 'loss' : 'draw',
        our_team_name: own, is_home: e.is_home, deep_link: `/app/live?matchId=${e.match_id}`,
        source: 'oefb_result_readonly' } });
    posted.add(e.match_id);
  }
  return result;
}

export async function fetchImportedResultFeedRows(seasonId: string, existing: TeamFeedPostDbRow[]): Promise<TeamFeedPostDbRow[]> {
  const { data, error } = await supabase.rpc('read_imported_result_feed', { p_team_season_id: seasonId });
  if (error) throw Error(error.message);
  const source = data as { team: { id: string; name: string }; events: ImportedResult[] } | null;
  if (!source?.team?.id || !source.team.name) return [];
  return buildImportedResultFeedRows(source.events ?? [], existing, [], [], source.team);
}
