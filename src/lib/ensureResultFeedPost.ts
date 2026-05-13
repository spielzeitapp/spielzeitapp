import { supabase } from './supabaseClient';
import { fetchMatchById } from './liveMatchService';
import { getMatchSides } from './matchSides';
import { getClubLogo } from './teamLogos';
import {
  buildAutoResultCaption,
  formatGoalMinuteLabel,
  type ResultFeedPayload,
  type ResultFeedScorer,
} from './resultFeedTypes';
import { formatFullLocation, splitCombinedLocation } from './eventLocation';

export type EnsureResultFeedPostResult =
  | { ok: true; created: boolean; reason?: string }
  | { ok: false; error: string };

function dedupeKeyForMatch(matchId: string): string {
  return `result_feed:${matchId}`;
}

type TeamSeasonJoinRow = {
  team_id: string | null;
  teams: { name: string | null } | { name: string | null }[] | null;
};

function teamNameFromSeasonRow(row: TeamSeasonJoinRow | null): { teamId: string; name: string } | null {
  if (!row?.team_id) return null;
  const raw = row.teams;
  const t = Array.isArray(raw) ? raw[0] : raw;
  const name = (t?.name != null ? String(t.name).trim() : '') || 'Unser Team';
  return { teamId: row.team_id, name };
}

type EventRowLite = {
  id: string;
  is_home: boolean | null;
  starts_at: string | null;
  meeting_at: string | null;
  location: string | null;
  address?: string | null;
  match_type: string | null;
  opponent: string | null;
  opponent_logo_url: string | null;
  opponent_slug?: string | null;
};

/**
 * Idempotent: legt genau einen Ergebnis-Feedpost pro Match an (dedupe_key).
 * Nur wenn `matches.status === 'finished'`. Kein Post bei laufendem Spiel.
 */
export async function ensureResultFeedPostForMatch(matchId: string): Promise<EnsureResultFeedPostResult> {
  const mid = matchId?.trim();
  if (!mid) return { ok: false, error: 'Keine Match-ID.' };

  const { data: match, error: matchErr } = await fetchMatchById(mid);
  if (matchErr) return { ok: false, error: matchErr };
  if (!match) return { ok: false, error: 'Spiel nicht gefunden.' };
  if (match.status !== 'finished') {
    return { ok: true, created: false, reason: 'not_finished' };
  }

  const dedupe_key = dedupeKeyForMatch(mid);
  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };
  if (existing?.id) return { ok: true, created: false, reason: 'already_exists' };

  const { data: tsRow, error: tsErr } = await supabase
    .from('team_seasons')
    .select('team_id, teams(name)')
    .eq('id', match.team_season_id)
    .maybeSingle();

  if (tsErr) return { ok: false, error: tsErr.message };
  const teamInfo = teamNameFromSeasonRow(tsRow as TeamSeasonJoinRow | null);
  if (!teamInfo) return { ok: false, error: 'Team zur Saison nicht gefunden.' };

  const { data: evRaw, error: evErr } = await supabase
    .from('events')
    .select(
      'id, is_home, starts_at, meeting_at, location, address, match_type, opponent, opponent_logo_url, opponent_slug',
    )
    .eq('match_id', mid)
    .maybeSingle();

  if (evErr) return { ok: false, error: evErr.message };
  const ev = (evRaw ?? null) as EventRowLite | null;

  const opponentName = (ev?.opponent ?? match.opponent ?? '').trim() || 'Gegner';
  const ownTeamName = teamInfo.name;
  const sides = getMatchSides({
    isHome: ev?.is_home,
    ownTeamName,
    opponentName,
  });

  const homeScore = Math.max(0, Math.trunc(Number(match.score_home ?? 0) || 0));
  const awayScore = Math.max(0, Math.trunc(Number(match.score_away ?? 0) || 0));
  const ourScore = sides.isOwnTeamHome ? homeScore : awayScore;
  const oppScore = sides.isOwnTeamHome ? awayScore : homeScore;
  let result_state: 'win' | 'draw' | 'loss' = 'draw';
  if (ourScore > oppScore) result_state = 'win';
  else if (ourScore < oppScore) result_state = 'loss';

  const oppLogo = ev?.opponent_logo_url ?? null;
  const oppSlug = ev?.opponent_slug ?? null;
  const home_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.homeTeamName)
    : getClubLogo(sides.homeTeamName, { slug: oppSlug, logoUrl: oppLogo });
  const away_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.awayTeamName, { slug: oppSlug, logoUrl: oppLogo })
    : getClubLogo(sides.awayTeamName);

  const locParsed = splitCombinedLocation(ev?.location ?? match.location ?? null);
  const location = formatFullLocation(locParsed.place, ev?.address ?? null) || (match.location ?? '').trim() || '—';

  const { data: goalRows, error: gErr } = await supabase
    .from('match_events')
    .select('id, type, minute, player_id')
    .eq('match_id', mid)
    .in('type', ['goal', 'goal_away'])
    .order('minute', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (gErr) return { ok: false, error: gErr.message };

  const ourGoalTypes: Set<string> = sides.isOwnTeamHome ? new Set(['goal']) : new Set(['goal_away']);
  const ourGoals = (goalRows ?? []).filter((r) => ourGoalTypes.has(String((r as { type?: string }).type ?? '')));

  const playerIds = [
    ...new Set(
      ourGoals
        .map((r) => (r as { player_id?: string | null }).player_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const nameByPlayer = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: players, error: pErr } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);
    if (pErr) return { ok: false, error: pErr.message };
    for (const pr of players ?? []) {
      const row = pr as { id: string; first_name?: string | null; last_name?: string | null };
      const fn = (row.first_name ?? '').trim();
      const ln = (row.last_name ?? '').trim();
      const dn = [fn, ln].join(' ').replace(/\s+/g, ' ').trim() || 'Spieler';
      nameByPlayer.set(row.id, dn);
    }
  }

  const scorers: ResultFeedScorer[] = ourGoals.map((r) => {
    const row = r as { player_id?: string | null; minute?: number | null };
    const pid = row.player_id;
    const label = formatGoalMinuteLabel(row.minute);
    const player_name = pid && nameByPlayer.has(pid) ? nameByPlayer.get(pid)! : '—';
    return { player_name, minute_label: label };
  });

  const starts_at = ev?.starts_at ?? match.match_date ?? null;
  const meeting_at = ev?.meeting_at ?? null;
  const event_id = ev?.id ?? null;
  const deep_link = event_id ? `/app/events/${event_id}` : `/app/live?matchId=${encodeURIComponent(mid)}`;

  const payload: ResultFeedPayload = {
    match_id: mid,
    event_id,
    team_season_id: match.team_season_id,
    home_team_name: sides.homeTeamName,
    away_team_name: sides.awayTeamName,
    home_logo_url,
    away_logo_url,
    home_score: homeScore,
    away_score: awayScore,
    match_type: ev?.match_type ?? null,
    starts_at,
    meeting_at,
    location,
    scorers,
    period_scores: match.period_scores ?? null,
    result_state,
    our_team_name: ownTeamName,
    is_home: sides.isOwnTeamHome,
    deep_link,
  };

  const caption = buildAutoResultCaption({
    ourTeamName: ownTeamName,
    opponentName,
    homeScore,
    awayScore,
    resultState: result_state,
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

  const { error: insErr } = await supabase.from('team_feed_posts').insert({
    team_season_id: match.team_season_id,
    team_id: teamInfo.teamId,
    event_id,
    post_kind: 'result_auto',
    caption,
    payload,
    dedupe_key,
    media_type: 'result',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: uid,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: true, created: false, reason: 'duplicate_race' };
    }
    return { ok: false, error: insErr.message };
  }

  return { ok: true, created: true };
}

/** Beim Feed-Laden: fehlende Ergebnis-Posts für kürzlich beendete Spiele nachziehen (Dedupe). */
export async function ensureRecentResultFeedPostsForSeason(teamSeasonId: string): Promise<void> {
  const sid = teamSeasonId?.trim();
  if (!sid) return;

  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('team_season_id', sid)
    .eq('status', 'finished')
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(15);

  if (error || !data?.length) return;

  for (const row of data as { id: string }[]) {
    const res = await ensureResultFeedPostForMatch(row.id);
    if (!res.ok && import.meta.env.DEV) {
      console.warn('[ensureRecentResultFeedPostsForSeason]', row.id, res.error);
    }
  }
}
