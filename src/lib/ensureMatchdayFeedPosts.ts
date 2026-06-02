import { supabase } from './supabaseClient';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';
import {
  buildMatchdayTodayCaption,
  buildMatchdayTomorrowCaption,
  dedupeKeyMatchdayToday,
  dedupeKeyMatchdayTomorrow,
} from './matchdayFeedCaptions';
import type { MatchdayFeedPayload } from './matchdayFeedTypes';
import { isNextViennaCalendarDay, isSameViennaCalendarDay } from './viennaTime';

export type EnsureMatchdayFeedPostsResult = {
  scanned: number;
  createdToday: number;
  createdTomorrow: number;
  skipped: number;
  errors: string[];
};

type EventRowLite = {
  id: string;
  team_season_id: string;
  kind: string | null;
  type: string | null;
  status: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  address?: string | null;
  starts_at: string;
  meeting_at: string | null;
  match_type: string | null;
  match_id: string | null;
  opponent_logo_url: string | null;
};

type TeamSeasonJoinRow = {
  team_id: string | null;
  teams: { name: string | null } | { name: string | null }[] | null;
};

function mdLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[matchdayFeed] ${phase}`, data);
}

async function resolveTeamForSeason(teamSeasonId: string): Promise<{ teamId: string; name: string } | null> {
  const { data: tsRow, error: tsErr } = await supabase
    .from('team_seasons')
    .select('team_id, teams(name)')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (!tsErr && tsRow?.team_id) {
    const row = tsRow as TeamSeasonJoinRow;
    const raw = row.teams;
    const t = Array.isArray(raw) ? raw[0] : raw;
    const nameFromJoin = (t?.name != null ? String(t.name).trim() : '') || '';
    return { teamId: row.team_id, name: nameFromJoin || 'Unser Team' };
  }

  const { data: minimal, error: minErr } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (minErr || !minimal?.team_id) return null;
  const teamId = minimal.team_id as string;
  const { data: teamRow } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
  const n = (teamRow as { name?: string | null } | null)?.name;
  const name = n != null && String(n).trim() ? String(n).trim() : 'Unser Team';
  return { teamId, name };
}

function isMatchEvent(e: EventRowLite): boolean {
  const kind = (e.kind ?? '').toLowerCase();
  const type = (e.type ?? '').toLowerCase();
  return kind === 'match' || type === 'game' || type === 'match';
}

async function isDedupeSuppressed(dedupe_key: string): Promise<boolean> {
  const { data } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  return Boolean(data?.dedupe_key);
}

async function postExists(dedupe_key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

function buildMatchdayPayload(
  event: EventRowLite,
  teamInfo: { teamId: string; name: string },
  timing: 'today' | 'tomorrow',
): MatchdayFeedPayload & { matchday_timing: 'today' | 'tomorrow' } {
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourName = teamInfo.name;
  const isHome = event.is_home !== false;
  const homeName = isHome ? ourName : opponent;
  const awayName = isHome ? opponent : ourName;
  const parsedLoc = splitCombinedLocation(event.location);
  const locationLine =
    (formatFullLocation(parsedLoc.place, event.address || parsedLoc.address || '') || '').trim() ||
    (event.location ?? '').trim();

  return {
    display_home_name: homeName,
    display_away_name: awayName,
    our_team_name: ourName,
    is_home: isHome,
    opponent_logo_url: event.opponent_logo_url?.trim() || null,
    match_type: event.match_type,
    kickoff_iso: event.starts_at,
    meeting_iso: event.meeting_at,
    location: locationLine,
    address: event.address ?? undefined,
    match_id: event.match_id,
    event_id: event.id,
    deep_link: event.match_id?.trim()
      ? `/app/match/${event.match_id.trim()}`
      : `/app/events/${event.id}`,
    matchday_timing: timing,
  };
}

async function insertMatchdayPost(params: {
  event: EventRowLite;
  teamInfo: { teamId: string; name: string };
  timing: 'today' | 'tomorrow';
}): Promise<{ created: boolean; skipped?: boolean; error?: string }> {
  const { event, teamInfo, timing } = params;
  const dedupe_key = timing === 'today' ? dedupeKeyMatchdayToday(event.id) : dedupeKeyMatchdayTomorrow(event.id);

  if (await isDedupeSuppressed(dedupe_key)) {
    return { created: false, skipped: true };
  }
  if (await postExists(dedupe_key)) {
    return { created: false, skipped: true };
  }

  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const payload = buildMatchdayPayload(event, teamInfo, timing);
  const caption =
    timing === 'today'
      ? buildMatchdayTodayCaption({
          ourTeamName: teamInfo.name,
          opponentName: opponent,
          startsAtIso: event.starts_at,
          location: event.location ?? '',
          address: event.address ?? undefined,
        })
      : buildMatchdayTomorrowCaption({
          opponentName: opponent,
          startsAtIso: event.starts_at,
          location: event.location ?? '',
          address: event.address ?? undefined,
        });

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

  const { error: insErr } = await supabase.from('team_feed_posts').insert({
    team_season_id: event.team_season_id,
    team_id: teamInfo.teamId,
    event_id: event.id,
    post_kind: timing === 'today' ? 'matchday_today_auto' : 'matchday_tomorrow_auto',
    caption,
    payload,
    dedupe_key,
    media_type: 'matchday',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: uid,
  });

  if (insErr) {
    if (insErr.code === '23505') return { created: false, skipped: true };
    return { created: false, error: insErr.message };
  }

  mdLog('created', { eventId: event.id, timing, dedupe_key });
  return { created: true };
}

/**
 * Idempotent: Heute-/Morgen-Spieltag-Posts pro Event (Dedupe matchday_today:/matchday_tomorrow:).
 */
export async function ensureMatchdayFeedPostsForSeason(
  teamSeasonId: string,
  now: Date = new Date(),
): Promise<EnsureMatchdayFeedPostsResult> {
  const sid = teamSeasonId?.trim();
  const result: EnsureMatchdayFeedPostsResult = {
    scanned: 0,
    createdToday: 0,
    createdTomorrow: 0,
    skipped: 0,
    errors: [],
  };
  if (!sid) return result;

  const teamInfo = await resolveTeamForSeason(sid);
  if (!teamInfo) {
    result.errors.push('Team zur Saison nicht gefunden.');
    return result;
  }

  const { data, error } = await supabase
    .from('events')
    .select(
      'id, team_season_id, kind, type, status, opponent, is_home, location, address, starts_at, meeting_at, match_type, match_id, opponent_logo_url',
    )
    .eq('team_season_id', sid)
    .neq('status', 'canceled')
    .neq('status', 'finished');

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const ev of (data ?? []) as EventRowLite[]) {
    if (!isMatchEvent(ev)) continue;
    if ((ev.status ?? 'upcoming').toLowerCase() !== 'upcoming') continue;
    if (!ev.starts_at) continue;

    const kick = new Date(ev.starts_at);
    if (Number.isNaN(kick.getTime())) continue;

    const isToday = isSameViennaCalendarDay(kick, now);
    const isTomorrow = isNextViennaCalendarDay(kick, now);
    if (!isToday && !isTomorrow) continue;

    result.scanned += 1;
    const timing = isToday ? 'today' : 'tomorrow';
    const res = await insertMatchdayPost({ event: ev, teamInfo, timing });
    if (res.error) {
      result.errors.push(`${ev.id}: ${res.error}`);
      continue;
    }
    if (res.created) {
      if (timing === 'today') result.createdToday += 1;
      else result.createdTomorrow += 1;
    } else {
      result.skipped += 1;
    }
  }

  mdLog('batch done', result);
  return result;
}
