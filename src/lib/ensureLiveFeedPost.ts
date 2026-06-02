import { supabase } from './supabaseClient';
import { fetchMatchById } from './liveMatchService';
import { getMatchSides } from './matchSides';
import { getClubLogo } from './teamLogos';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';
import {
  buildAutoLiveFeedCaption,
  dedupeKeyForLiveMatch,
  type LiveFeedPayload,
} from './liveFeedTypes';

export type EnsureLiveFeedPostResult =
  | { ok: true; created: boolean; reason?: string }
  | { ok: false; error: string };

function lfLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[liveFeed] ${phase}`, data);
}

type TeamSeasonJoinRow = {
  team_id: string | null;
  teams: { name: string | null } | { name: string | null }[] | null;
};

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

type EventRowLite = {
  id: string;
  is_home: boolean | null;
  starts_at: string | null;
  location: string | null;
  address?: string | null;
  match_type: string | null;
  opponent: string | null;
  opponent_logo_url: string | null;
  opponent_slug?: string | null;
};

function matchIsLive(status: string | null | undefined, liveIsRunning: boolean | null | undefined): boolean {
  const st = (status ?? '').toLowerCase();
  return st === 'live' || Boolean(liveIsRunning);
}

/**
 * Idempotent: höchstens ein LIVE-Feedpost pro Match (dedupe_key live_feed:match_id).
 */
export async function ensureLiveFeedPostForMatch(matchId: string): Promise<EnsureLiveFeedPostResult> {
  const mid = matchId?.trim();
  if (!mid) return { ok: false, error: 'Keine Match-ID.' };

  const dedupe_key = dedupeKeyForLiveMatch(mid);

  const { data: suppressed } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (suppressed?.dedupe_key) {
    lfLog('skip: suppressed', { matchId: mid, dedupe_key });
    return { ok: true, created: false, reason: 'suppressed' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };
  if (existing?.id) return { ok: true, created: false, reason: 'already_exists' };

  const { data: match, error: matchErr } = await fetchMatchById(mid);
  if (matchErr) return { ok: false, error: matchErr };
  if (!match) return { ok: false, error: 'Spiel nicht gefunden.' };

  if (!matchIsLive(match.status, match.live_is_running)) {
    lfLog('skip: not_live', { matchId: mid, status: match.status });
    return { ok: true, created: false, reason: 'not_live' };
  }

  const teamSeasonId = match.team_season_id?.trim();
  if (!teamSeasonId) return { ok: false, error: 'Keine team_season_id am Spiel.' };

  const teamInfo = await resolveTeamForSeason(teamSeasonId);
  if (!teamInfo) return { ok: false, error: 'Team zur Saison nicht gefunden.' };

  const { data: evRaw, error: evErr } = await supabase
    .from('events')
    .select(
      'id, is_home, starts_at, location, address, match_type, opponent, opponent_logo_url, opponent_slug',
    )
    .eq('match_id', mid)
    .maybeSingle();

  if (evErr) lfLog('events lookup warning', { matchId: mid, error: evErr.message });
  const ev = (evErr ? null : evRaw) as EventRowLite | null;
  const eventId = ev?.id?.trim() ?? '';
  if (!eventId) return { ok: false, error: 'Kein Event zum Spiel verknüpft.' };

  const opponentName = (ev?.opponent ?? match.opponent ?? '').trim() || 'Gegner';
  const ownTeamName = teamInfo.name;
  const sides = getMatchSides({
    isHome: ev?.is_home,
    ownTeamName,
    opponentName,
  });

  const oppLogo = ev?.opponent_logo_url ?? null;
  const oppSlug = ev?.opponent_slug ?? null;
  const home_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.homeTeamName)
    : getClubLogo(sides.homeTeamName, { slug: oppSlug ?? undefined, logoUrl: oppLogo });
  const away_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.awayTeamName, { slug: oppSlug ?? undefined, logoUrl: oppLogo })
    : getClubLogo(sides.awayTeamName);

  const locParsed = splitCombinedLocation(ev?.location ?? match.location ?? null);
  const location =
    (formatFullLocation(locParsed.place, ev?.address || locParsed.address || '') || '').trim() ||
    (ev?.location ?? match.location ?? '').trim();

  const starts_at = ev?.starts_at ?? match.match_date ?? null;
  const deep_link = `/app/live/${mid}`;

  const payload: LiveFeedPayload = {
    match_id: mid,
    event_id: eventId,
    team_season_id: teamSeasonId,
    home_team_name: sides.homeTeamName,
    away_team_name: sides.awayTeamName,
    home_logo_url,
    away_logo_url,
    starts_at,
    location,
    match_type: ev?.match_type ?? null,
    status: 'live',
    deep_link,
  };

  const caption = buildAutoLiveFeedCaption(sides.homeTeamName, sides.awayTeamName);

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

  const { error: insErr } = await supabase.from('team_feed_posts').insert({
    team_season_id: teamSeasonId,
    team_id: teamInfo.teamId,
    event_id: eventId,
    post_kind: 'live_auto',
    caption,
    payload,
    dedupe_key,
    media_type: 'live',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: uid,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: true, created: false, reason: 'already_exists' };
    }
    return { ok: false, error: insErr.message };
  }

  lfLog('created', { matchId: mid, dedupe_key, eventId });
  return { ok: true, created: true };
}

export type EnsureRecentLiveFeedPostsResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: string[];
};

/** Beim Feed-Laden: für alle laufenden Matches der Saison LIVE-Posts sicherstellen. */
export async function ensureRecentLiveFeedPostsForSeason(
  teamSeasonId: string,
): Promise<EnsureRecentLiveFeedPostsResult> {
  const sid = teamSeasonId?.trim();
  const result: EnsureRecentLiveFeedPostsResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };
  if (!sid) return result;

  const { data, error } = await supabase
    .from('matches')
    .select('id, status, live_is_running')
    .eq('team_season_id', sid)
    .eq('status', 'live');

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    const st = (row as { status?: string }).status;
    const running = (row as { live_is_running?: boolean }).live_is_running;
    if (!matchIsLive(st, running)) continue;

    result.scanned += 1;
    const res = await ensureLiveFeedPostForMatch(id);
    if (!res.ok) {
      result.errors.push(`${id}: ${res.error}`);
      continue;
    }
    if (res.created) result.created += 1;
    else result.skipped += 1;
  }

  lfLog('batch done', result);
  return result;
}
