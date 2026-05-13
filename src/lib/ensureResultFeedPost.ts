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

function rfLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[resultFeed] ${phase}`, data);
}

function dedupeKeyForMatch(matchId: string): string {
  return `result_feed:${matchId}`;
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

  rfLog('resolveTeamForSeason: join failed or empty, fallback team_id only', {
    teamSeasonId,
    error: tsErr?.message ?? null,
  });

  const { data: minimal, error: minErr } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (minErr || !minimal?.team_id) {
    rfLog('resolveTeamForSeason: fallback failed', { error: minErr?.message ?? 'no team_id' });
    return null;
  }

  const teamId = minimal.team_id as string;
  const { data: teamRow } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
  const n = (teamRow as { name?: string | null } | null)?.name;
  const name = (n != null && String(n).trim()) ? String(n).trim() : 'Unser Team';
  return { teamId, name };
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

type RpcResultRow = {
  ok?: boolean;
  created?: boolean;
  error?: string;
  reason?: string;
};

/**
 * Idempotent: legt genau einen Ergebnis-Feedpost pro Match an (dedupe_key).
 * Nur wenn `matches.status === 'finished'`. INSERT über RPC (SECURITY DEFINER), analog Matchday-Automation.
 */
export async function ensureResultFeedPostForMatch(matchId: string): Promise<EnsureResultFeedPostResult> {
  const mid = matchId?.trim();
  if (!mid) {
    rfLog('ensureResultFeedPostForMatch', { error: 'empty_match_id' });
    return { ok: false, error: 'Keine Match-ID.' };
  }

  const dedupe_key = dedupeKeyForMatch(mid);

  const { data: match, error: matchErr } = await fetchMatchById(mid);
  rfLog('match loaded', {
    matchId: mid,
    ok: !matchErr && !!match,
    error: matchErr ?? null,
    status: match?.status ?? null,
    team_season_id: match?.team_season_id ?? null,
    score_home: match?.score_home ?? null,
    score_away: match?.score_away ?? null,
  });

  if (matchErr) return { ok: false, error: matchErr };
  if (!match) return { ok: false, error: 'Spiel nicht gefunden.' };
  if (match.status !== 'finished') {
    rfLog('skip: not_finished', { matchId: mid, status: match.status, dedupe_key });
    return { ok: true, created: false, reason: 'not_finished' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();

  rfLog('dedupe check', { dedupe_key, exists: !!existing?.id, selectError: exErr?.message ?? null });

  if (exErr) return { ok: false, error: exErr.message };
  if (existing?.id) return { ok: true, created: false, reason: 'already_exists' };

  const teamInfo = await resolveTeamForSeason(match.team_season_id);
  rfLog('team resolved', {
    team_season_id: match.team_season_id,
    teamId: teamInfo?.teamId ?? null,
    teamName: teamInfo?.name ?? null,
  });

  if (!teamInfo) {
    return { ok: false, error: 'Team zur Saison nicht gefunden.' };
  }

  const { data: evRaw, error: evErr } = await supabase
    .from('events')
    .select(
      'id, is_home, starts_at, meeting_at, location, address, match_type, opponent, opponent_logo_url, opponent_slug',
    )
    .eq('match_id', mid)
    .maybeSingle();

  if (evErr) {
    rfLog('events lookup warning (using fallbacks)', { matchId: mid, error: evErr.message });
  }
  const ev = (evErr ? null : evRaw) as EventRowLite | null;

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
    : getClubLogo(sides.homeTeamName, { slug: oppSlug ?? undefined, logoUrl: oppLogo });
  const away_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.awayTeamName, { slug: oppSlug ?? undefined, logoUrl: oppLogo })
    : getClubLogo(sides.awayTeamName);

  const locParsed = splitCombinedLocation(ev?.location ?? match.location ?? null);
  const location =
    formatFullLocation(locParsed.place, ev?.address ?? null) || (match.location ?? '').trim() || '—';

  let goalRows: { id?: string; type?: string; minute?: number | null; player_id?: string | null }[] = [];
  const { data: goalsData, error: gErr } = await supabase
    .from('match_events')
    .select('id, type, minute, player_id')
    .eq('match_id', mid)
    .in('type', ['goal', 'goal_away'])
    .order('minute', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (gErr) {
    rfLog('match_events goals warning', { matchId: mid, error: gErr.message });
  } else {
    goalRows = (goalsData ?? []) as typeof goalRows;
  }

  const ourGoalTypes: Set<string> = sides.isOwnTeamHome ? new Set(['goal']) : new Set(['goal_away']);
  const ourGoals = goalRows.filter((r) => ourGoalTypes.has(String(r.type ?? '')));

  const playerIds = [
    ...new Set(
      ourGoals.map((r) => r.player_id).filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const nameByPlayer = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: players, error: pErr } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);
    if (pErr) {
      rfLog('players lookup warning', { error: pErr.message });
    } else {
      for (const pr of players ?? []) {
        const row = pr as { id: string; first_name?: string | null; last_name?: string | null };
        const fn = (row.first_name ?? '').trim();
        const ln = (row.last_name ?? '').trim();
        const dn = [fn, ln].join(' ').replace(/\s+/g, ' ').trim() || 'Spieler';
        nameByPlayer.set(row.id, dn);
      }
    }
  }

  const scorers: ResultFeedScorer[] = ourGoals.map((r) => {
    const pid = r.player_id;
    const label = formatGoalMinuteLabel(r.minute);
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

  rfLog('calling rpc ensure_result_feed_post_for_match', {
    matchId: mid,
    dedupe_key,
    post_kind: 'result_auto',
    media_type: 'result',
    captionLen: caption.length,
  });

  const { data: rpcData, error: rpcErr } = await supabase.rpc('ensure_result_feed_post_for_match', {
    p_match_id: mid,
    p_caption: caption,
    p_payload: payload as unknown as Record<string, unknown>,
  });

  if (rpcErr) {
    rfLog('rpc failed', {
      message: rpcErr.message,
      code: rpcErr.code,
      details: rpcErr.details,
      hint: rpcErr.hint,
    });
    return { ok: false, error: rpcErr.message };
  }

  const row = rpcData as RpcResultRow | null;
  rfLog('rpc result', { raw: rpcData });

  if (!row || row.ok === false) {
    const err = row?.error ?? 'rpc_ok_missing';
    rfLog('rpc logical error', { error: err });
    return { ok: false, error: err };
  }

  if (row.created) {
    rfLog('insert success', { matchId: mid, dedupe_key, post_kind: 'result_auto', media_type: 'result' });
  } else {
    rfLog('no new row', { matchId: mid, reason: row.reason ?? null });
  }

  return { ok: true, created: !!row.created, reason: row.reason };
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

  for (const r of data as { id: string }[]) {
    const res = await ensureResultFeedPostForMatch(r.id);
    if (!res.ok) {
      rfLog('ensureRecentResultFeedPostsForSeason', { matchId: r.id, error: res.error });
    }
  }
}
