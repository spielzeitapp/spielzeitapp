import { supabase } from './supabaseClient';
import { getClubLogo } from './teamLogos';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';
import {
  buildAutoNextMatchCaption,
  dedupeKeyForNextMatchEvent,
  type NextMatchFeedPayload,
} from './nextMatchFeedTypes';
import { viennaCalendarDaysUntil } from './viennaTime';

export type EnsureUpcomingMatchFeedPostsResult = {
  scanned: number;
  created: number;
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

function nmLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[nextMatchFeed] ${phase}`, data);
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

function isMatchEvent(e: EventRowLite): boolean {
  const kind = (e.kind ?? '').toLowerCase();
  const type = (e.type ?? '').toLowerCase();
  return kind === 'match' || type === 'game' || type === 'match';
}

async function ensureNextMatchFeedPostForEvent(
  event: EventRowLite,
  teamInfo: { teamId: string; name: string },
): Promise<{ created: boolean; skipped?: boolean; error?: string }> {
  const eventId = event.id;
  const dedupe_key = dedupeKeyForNextMatchEvent(eventId);

  const { data: suppressed } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (suppressed?.dedupe_key) {
    return { created: false, skipped: true };
  }

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (exErr) return { created: false, error: exErr.message };
  if (existing?.id) return { created: false, skipped: true };

  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourName = teamInfo.name;
  const isHome = event.is_home !== false;
  const homeName = isHome ? ourName : opponent;
  const awayName = isHome ? opponent : ourName;
  const oppLogo = event.opponent_logo_url?.trim() || null;
  const home_logo_url = isHome ? getClubLogo(ourName) : getClubLogo(homeName, { logoUrl: oppLogo ?? undefined });
  const away_logo_url = isHome
    ? getClubLogo(awayName, { logoUrl: oppLogo ?? undefined })
    : getClubLogo(ourName);

  const parsedLoc = splitCombinedLocation(event.location);
  const locationLine =
    (formatFullLocation(parsedLoc.place, event.address || parsedLoc.address || '') || '').trim() ||
    (event.location ?? '').trim();

  const deep_link =
    event.match_id?.trim()
      ? `/app/match/${event.match_id.trim()}`
      : `/app/events/${eventId}`;

  const payload: NextMatchFeedPayload & {
    home_logo_url: string;
    away_logo_url: string;
  } = {
    display_home_name: homeName,
    display_away_name: awayName,
    our_team_name: ourName,
    is_home: isHome,
    opponent_logo_url: oppLogo,
    match_type: event.match_type,
    kickoff_iso: event.starts_at,
    meeting_iso: event.meeting_at,
    location: locationLine,
    address: event.address ?? undefined,
    match_id: event.match_id,
    event_id: eventId,
    deep_link,
    home_logo_url,
    away_logo_url,
  };

  const caption = buildAutoNextMatchCaption({
    ourTeamName: ourName,
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
    event_id: eventId,
    post_kind: 'next_match_auto',
    caption,
    payload,
    dedupe_key,
    media_type: 'next_match',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: uid,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { created: false, skipped: true };
    }
    return { created: false, error: insErr.message };
  }

  nmLog('created', { eventId, dedupe_key });
  return { created: true };
}

/**
 * Idempotent: für jedes Spiel in 2–5 Tagen (Wien) höchstens ein Feed-Post (next_match_feed:event_id).
 */
export async function ensureUpcomingMatchFeedPosts(
  teamSeasonId: string,
  now: Date = new Date(),
): Promise<EnsureUpcomingMatchFeedPostsResult> {
  const sid = teamSeasonId?.trim();
  const result: EnsureUpcomingMatchFeedPostsResult = {
    scanned: 0,
    created: 0,
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
      'id, team_season_id, kind, type, status, opponent, is_home, location, starts_at, meeting_at, match_type, match_id',
    )
    .eq('team_season_id', sid)
    .not('status', 'in', '(canceled,finished)')
    .order('starts_at', { ascending: true });

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = (data ?? []) as EventRowLite[];

  for (const ev of rows) {
    if (!isMatchEvent(ev)) continue;
    const st = (ev.status ?? 'upcoming').toLowerCase();
    if (st !== 'upcoming') continue;
    if (!ev.starts_at) continue;

    const kick = new Date(ev.starts_at);
    if (Number.isNaN(kick.getTime())) continue;

    const days = viennaCalendarDaysUntil(kick, now);
    if (days == null || days < 2 || days > 5) continue;

    result.scanned += 1;
    const res = await ensureNextMatchFeedPostForEvent(ev, teamInfo);
    if (res.error) {
      result.errors.push(`${ev.id}: ${res.error}`);
      continue;
    }
    if (res.created) result.created += 1;
    else result.skipped += 1;
  }

  nmLog('batch done', result);
  return result;
}
