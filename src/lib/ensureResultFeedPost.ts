import { supabase } from './supabaseClient';
import { isDemoMatchId } from '../demo/demoLiveRuntime';
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
  is_home: boolean;
  starts_at: string | null;
  meeting_at: string | null;
  location: string | null;
  match_type: string | null;
  opponent: string | null;
  opponent_logo_url: string | null;
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
  // Demo: kein Feed, kein Push, keine Supabase-Writes.
  if (isDemoMatchId(mid)) return { ok: true, created: false, reason: 'demo' };

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

  // Hinweis: auto_matchday_feed_enabled steuert NUR den Spieltag-Post/Hero.
  // Der Ergebnis-Post bleibt davon unabhängig und wird immer erstellt.

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();

  rfLog('dedupe check', { dedupe_key, exists: !!existing?.id, selectError: exErr?.message ?? null });

  if (exErr) return { ok: false, error: exErr.message };
  // Ein vorhandener Ergebnis-Post wird weiter unten über das RPC aktualisiert.
  // So bleiben Torschützenkorrekturen nach dem Schlusspfiff auch im Feed synchron.

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
    .select('id, is_home, starts_at, meeting_at, location, match_type, opponent, opponent_logo_url')
    .eq('match_id', mid)
    .maybeSingle();

  if (evErr || !evRaw) {
    console.warn('[resultFeed] event lookup failed, skipping result post', {
      matchId: mid,
      error: evErr?.message ?? 'no_event_row',
    });
    return { ok: false, error: evErr?.message ?? 'Kalendertermin zum Spiel nicht gefunden.' };
  }

  const ev = evRaw as EventRowLite;

  if (ev.is_home !== true && ev.is_home !== false) {
    console.warn('[resultFeed] is_home missing on event, skipping result post', {
      matchId: mid,
      eventId: ev.id,
      is_home: ev.is_home,
    });
    return { ok: false, error: 'Heim/Auswärts am Termin nicht gesetzt.' };
  }

  const opponentName = (ev.opponent ?? match.opponent ?? '').trim() || 'Gegner';
  const ownTeamName = teamInfo.name;
  const sides = getMatchSides({
    isHome: ev.is_home,
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

  const opponentLogoUrl = ev.opponent_logo_url?.trim() || null;
  const home_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.homeTeamName, { ourTeam: true })
    : getClubLogo(sides.homeTeamName, { logoUrl: opponentLogoUrl });
  const away_logo_url = sides.isOwnTeamHome
    ? getClubLogo(sides.awayTeamName, { logoUrl: opponentLogoUrl })
    : getClubLogo(sides.awayTeamName, { ourTeam: true });

  const locParsed = splitCombinedLocation(ev.location ?? match.location ?? null);
  const location =
    formatFullLocation(locParsed.place, locParsed.address || '') || (match.location ?? '').trim() || '—';

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

  const starts_at = ev.starts_at ?? match.match_date ?? null;
  const meeting_at = ev.meeting_at ?? null;
  const event_id = ev.id;
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
    match_type: ev.match_type ?? null,
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

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

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
    const missingFn =
      /could not find the function|function .* does not exist|404/i.test(String(rpcErr.message ?? '')) ||
      rpcErr.code === '42883';
    if (!missingFn) {
      return { ok: false, error: rpcErr.message };
    }
    rfLog('rpc missing (Migration?), fallback client insert', { matchId: mid });
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
      rfLog('fallback insert failed', {
        message: insErr.message,
        code: insErr.code,
      });
      if (insErr.code === '23505') {
        return { ok: true, created: false, reason: 'duplicate_race' };
      }
      return { ok: false, error: insErr.message };
    }
    rfLog('fallback insert success', { matchId: mid, dedupe_key });
    return { ok: true, created: true };
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
