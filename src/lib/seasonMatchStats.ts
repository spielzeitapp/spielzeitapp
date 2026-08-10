import { supabase } from './supabaseClient';
import { isInactiveEventStatus } from './eventFilters';

/**
 * Match-IDs, die für Saisonsstatistik zählen:
 * - Liga/Freundschaftsspiel mit aktivem Event
 * - Turnierspiel mit aktivem Turnier-Event
 * - optional: alle Matches der Saison (Archiv / Orphans ohne Event-Zeile)
 */
export async function fetchValidSeasonMatchIds(
  teamSeasonId: string,
  opts?: { includeOrphanMatches?: boolean },
): Promise<Set<string>> {
  const sid = teamSeasonId.trim();
  const valid = new Set<string>();
  if (!sid) return valid;

  const { data: matchEvents, error: matchEvErr } = await supabase
    .from('events')
    .select('match_id, status, kind')
    .eq('team_season_id', sid)
    .eq('kind', 'match')
    .not('match_id', 'is', null);

  if (!matchEvErr) {
    for (const row of matchEvents ?? []) {
      const mid = (row as { match_id?: string | null }).match_id;
      if (!mid || isInactiveEventStatus((row as { status?: string | null }).status)) continue;
      valid.add(String(mid));
    }
  }

  const { data: tournamentEvents, error: tourEvErr } = await supabase
    .from('events')
    .select('id, status')
    .eq('team_season_id', sid)
    .eq('kind', 'tournament');

  if (!tourEvErr) {
    const activeTournamentIds = (tournamentEvents ?? [])
      .filter((row) => !isInactiveEventStatus((row as { status?: string | null }).status))
      .map((row) => String((row as { id: string }).id));

    if (activeTournamentIds.length > 0) {
      const { data: tmRows, error: tmErr } = await supabase
        .from('tournament_matches')
        .select('match_id')
        .in('tournament_event_id', activeTournamentIds);

      if (!tmErr) {
        for (const row of tmRows ?? []) {
          const mid = (row as { match_id?: string }).match_id;
          if (mid) valid.add(String(mid));
        }
      }
    }
  }

  if (opts?.includeOrphanMatches) {
    const { data: seasonMatches, error: smErr } = await supabase
      .from('matches')
      .select('id')
      .eq('team_season_id', sid);
    if (!smErr) {
      for (const row of seasonMatches ?? []) {
        const mid = (row as { id?: string }).id;
        if (mid) valid.add(String(mid));
      }
    }
  }

  return valid;
}

export type VisibleSeasonMatch = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

/** Sichtbare Saison-Spiele (nur an aktive Events gebunden, wie Trainerstatistik). */
export async function fetchVisibleSeasonMatches(
  teamSeasonId: string,
  limit?: number,
): Promise<VisibleSeasonMatch[]> {
  const sid = teamSeasonId.trim();
  if (!sid) return [];

  const validIds = await fetchValidSeasonMatchIds(sid);
  if (validIds.size === 0) return [];

  let query = supabase
    .from('matches')
    .select('id, opponent, match_date, status, score_home, score_away')
    .eq('team_season_id', sid)
    .in('id', [...validIds])
    .order('match_date', { ascending: false });

  if (limit != null && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as VisibleSeasonMatch[];
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Heim/Auswärts je Match (Liga-Event oder Turnier-Event). */
export async function fetchIsHomeByMatchId(
  teamSeasonId: string,
  validMatchIds: Set<string>,
): Promise<Map<string, boolean | null>> {
  const sid = teamSeasonId.trim();
  const isHomeByMatchId = new Map<string, boolean | null>();
  if (!sid || validMatchIds.size === 0) return isHomeByMatchId;

  const { data: matchEvents, error: matchEvErr } = await supabase
    .from('events')
    .select('match_id, is_home')
    .eq('team_season_id', sid)
    .eq('kind', 'match')
    .not('match_id', 'is', null);

  if (!matchEvErr) {
    for (const ev of matchEvents ?? []) {
      const mid = (ev as { match_id?: string | null }).match_id;
      if (mid && validMatchIds.has(String(mid))) {
        isHomeByMatchId.set(String(mid), (ev as { is_home?: boolean | null }).is_home ?? null);
      }
    }
  }

  const { data: tmRows, error: tmErr } = await supabase
    .from('tournament_matches')
    .select('match_id, tournament_event_id')
    .in('match_id', [...validMatchIds]);

  if (!tmErr && (tmRows ?? []).length > 0) {
    const tournamentEventIds = [
      ...new Set((tmRows ?? []).map((r) => (r as { tournament_event_id: string }).tournament_event_id)),
    ];
    const { data: tourEvents } = await supabase
      .from('events')
      .select('id, is_home')
      .in('id', tournamentEventIds);

    const homeByTournamentId = new Map<string, boolean | null>();
    for (const ev of tourEvents ?? []) {
      homeByTournamentId.set(String((ev as { id: string }).id), (ev as { is_home?: boolean | null }).is_home ?? null);
    }

    for (const tm of tmRows ?? []) {
      const mid = String((tm as { match_id: string }).match_id);
      if (!isHomeByMatchId.has(mid)) {
        const tid = (tm as { tournament_event_id: string }).tournament_event_id;
        isHomeByMatchId.set(mid, homeByTournamentId.get(tid) ?? true);
      }
    }
  }

  return isHomeByMatchId;
}

export type CoachMatchOutcome = 'win' | 'draw' | 'loss';

export type CoachSeasonMatchDetail = VisibleSeasonMatch & {
  teamGoals: number | null;
  oppGoals: number | null;
  outcome: CoachMatchOutcome | null;
};

function resolveCoachMatchDetail(
  row: VisibleSeasonMatch,
  isHome: boolean | null,
): CoachSeasonMatchDetail {
  const st = (row.status ?? '').trim().toLowerCase();
  if (st !== 'finished') {
    return { ...row, teamGoals: null, oppGoals: null, outcome: null };
  }

  const sh = toNum(row.score_home);
  const sa = toNum(row.score_away);
  if (sh == null || sa == null) {
    return { ...row, teamGoals: null, oppGoals: null, outcome: null };
  }

  const home = isHome ?? true;
  const teamGoals = home ? sh : sa;
  const oppGoals = home ? sa : sh;
  let outcome: CoachMatchOutcome;
  if (teamGoals > oppGoals) outcome = 'win';
  else if (teamGoals === oppGoals) outcome = 'draw';
  else outcome = 'loss';

  return { ...row, teamGoals, oppGoals, outcome };
}

/** Abgeschlossene Saison-Spiele mit Team-Perspektive (für Trainerprofil). */
export async function fetchCoachSeasonMatchDetails(
  teamSeasonId: string,
  limit?: number,
): Promise<CoachSeasonMatchDetail[]> {
  const sid = teamSeasonId.trim();
  if (!sid) return [];

  const validIds = await fetchValidSeasonMatchIds(sid);
  if (validIds.size === 0) return [];

  const [rows, isHomeByMatchId] = await Promise.all([
    fetchVisibleSeasonMatches(sid),
    fetchIsHomeByMatchId(sid, validIds),
  ]);

  const details = rows.map((row) =>
    resolveCoachMatchDetail(row, isHomeByMatchId.get(row.id) ?? null),
  );

  const finished = details.filter((m) => m.outcome != null);
  if (limit != null && limit > 0) {
    return finished.slice(0, limit);
  }
  return finished;
}

export type CoachSeasonAchievements = {
  winRatePct: number | null;
  maxGoalsInGame: number | null;
  longestWinStreak: number | null;
};

export function computeCoachSeasonAchievements(matches: CoachSeasonMatchDetail[]): CoachSeasonAchievements {
  const finished = matches.filter((m) => m.outcome != null);
  if (finished.length === 0) {
    return { winRatePct: null, maxGoalsInGame: null, longestWinStreak: null };
  }

  const wins = finished.filter((m) => m.outcome === 'win').length;
  const winRatePct = Math.round((wins / finished.length) * 100);

  const maxGoalsInGame = finished.reduce((max, m) => {
    const g = m.teamGoals ?? 0;
    return g > max ? g : max;
  }, 0);

  const chronological = [...finished].sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : 0;
    const db = b.match_date ? new Date(b.match_date).getTime() : 0;
    return da - db;
  });

  let longestWinStreak = 0;
  let current = 0;
  for (const m of chronological) {
    if (m.outcome === 'win') {
      current += 1;
      longestWinStreak = Math.max(longestWinStreak, current);
    } else {
      current = 0;
    }
  }

  return {
    winRatePct,
    maxGoalsInGame: maxGoalsInGame > 0 ? maxGoalsInGame : null,
    longestWinStreak: longestWinStreak > 0 ? longestWinStreak : null,
  };
}

export type SeasonMatchSummary = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  pointsPerGame: string;
};

const EMPTY_SEASON_SUMMARY: SeasonMatchSummary = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  pointsPerGame: '–',
};

/** Bilanz nur aus abgeschlossenen gültigen Spielen mit Ergebnis. */
export function computeSeasonMatchSummary(matches: CoachSeasonMatchDetail[]): SeasonMatchSummary {
  const finished = matches.filter((m) => m.outcome != null);
  if (finished.length === 0) return { ...EMPTY_SEASON_SUMMARY };

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;

  for (const m of finished) {
    goalsFor += m.teamGoals ?? 0;
    goalsAgainst += m.oppGoals ?? 0;
    if (m.outcome === 'win') {
      wins += 1;
      points += 3;
    } else if (m.outcome === 'draw') {
      draws += 1;
      points += 1;
    } else {
      losses += 1;
    }
  }

  return {
    played: finished.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    pointsPerGame: (points / finished.length).toFixed(2),
  };
}

export type SeasonMatchDisplayStatus = 'win' | 'draw' | 'loss' | 'live' | 'upcoming';

export type SeasonMatchCardData = CoachSeasonMatchDetail & {
  eventId: string | null;
  location: string | null;
  isHome: boolean | null;
  displayStatus: SeasonMatchDisplayStatus;
};

export type SeasonMatchBoard = {
  summary: SeasonMatchSummary;
  upcoming: SeasonMatchCardData[];
  recent: SeasonMatchCardData[];
  all: SeasonMatchCardData[];
};

type MatchEventMeta = {
  eventId: string;
  location: string | null;
  isHome: boolean | null;
};

async function fetchEventMetaByMatchId(
  teamSeasonId: string,
  validMatchIds: Set<string>,
): Promise<Map<string, MatchEventMeta>> {
  const sid = teamSeasonId.trim();
  const meta = new Map<string, MatchEventMeta>();
  if (!sid || validMatchIds.size === 0) return meta;

  const { data: matchEvents, error: matchEvErr } = await supabase
    .from('events')
    .select('id, match_id, location, is_home, status, fixture_status')
    .eq('team_season_id', sid)
    .eq('kind', 'match')
    .not('match_id', 'is', null);

  if (!matchEvErr) {
    for (const row of matchEvents ?? []) {
      const fs = String((row as { fixture_status?: string | null }).fixture_status ?? '')
        .trim()
        .toLowerCase();
      if (fs === 'open' || fs === 'agreed') continue;
      const mid = (row as { match_id?: string | null }).match_id;
      if (!mid || !validMatchIds.has(String(mid))) continue;
      if (isInactiveEventStatus((row as { status?: string | null }).status)) continue;
      meta.set(String(mid), {
        eventId: String((row as { id: string }).id),
        location: (row as { location?: string | null }).location ?? null,
        isHome: (row as { is_home?: boolean | null }).is_home ?? null,
      });
    }
  }

  const { data: tmRows, error: tmErr } = await supabase
    .from('tournament_matches')
    .select('match_id, tournament_event_id')
    .in('match_id', [...validMatchIds]);

  if (!tmErr && (tmRows ?? []).length > 0) {
    const tournamentEventIds = [
      ...new Set((tmRows ?? []).map((r) => (r as { tournament_event_id: string }).tournament_event_id)),
    ];
    const { data: tourEvents } = await supabase
      .from('events')
      .select('id, is_home, location, status')
      .in('id', tournamentEventIds);

    const tourById = new Map<string, { id: string; is_home: boolean | null; location: string | null }>();
    for (const ev of tourEvents ?? []) {
      if (isInactiveEventStatus((ev as { status?: string | null }).status)) continue;
      tourById.set(String((ev as { id: string }).id), {
        id: String((ev as { id: string }).id),
        is_home: (ev as { is_home?: boolean | null }).is_home ?? null,
        location: (ev as { location?: string | null }).location ?? null,
      });
    }

    for (const tm of tmRows ?? []) {
      const mid = String((tm as { match_id: string }).match_id);
      if (meta.has(mid)) continue;
      const tid = (tm as { tournament_event_id: string }).tournament_event_id;
      const ev = tourById.get(tid);
      if (!ev) continue;
      meta.set(mid, {
        eventId: ev.id,
        location: ev.location,
        isHome: ev.is_home,
      });
    }
  }

  return meta;
}

function resolveDisplayStatus(
  detail: CoachSeasonMatchDetail,
  rawStatus: string | null,
): SeasonMatchDisplayStatus {
  const st = (rawStatus ?? '').trim().toLowerCase();
  if (st === 'live') return 'live';
  if (detail.outcome === 'win') return 'win';
  if (detail.outcome === 'draw') return 'draw';
  if (detail.outcome === 'loss') return 'loss';
  return 'upcoming';
}

function compareMatchDateAsc(a: SeasonMatchCardData, b: SeasonMatchCardData): number {
  const da = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
  const db = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
  return da - db;
}

function compareMatchDateDesc(a: SeasonMatchCardData, b: SeasonMatchCardData): number {
  const da = a.match_date ? new Date(a.match_date).getTime() : 0;
  const db = b.match_date ? new Date(b.match_date).getTime() : 0;
  return db - da;
}

/** Zielroute für Saison-Spielkarten — Event-Detail bevorzugt, sonst Match-Detail. */
export function seasonMatchCardHref(
  eventId: string | null | undefined,
  base: '/app' | '/demo' = '/app',
  matchId?: string | null,
): string | null {
  const eid = (eventId ?? '').trim();
  if (eid) return `${base}/events/${encodeURIComponent(eid)}`;
  const mid = (matchId ?? '').trim();
  if (mid) return `${base}/match/${encodeURIComponent(mid)}`;
  return null;
}

type BoardMatchRow = VisibleSeasonMatch & {
  location: string | null;
};

/** Gültige Saison-Spiele inkl. Bilanz, kommende und letzte Spiele. */
export async function fetchSeasonMatchBoard(
  teamSeasonId: string,
  recentLimit = 10,
  opts?: { includeOrphanMatches?: boolean },
): Promise<SeasonMatchBoard> {
  const sid = teamSeasonId.trim();
  const empty: SeasonMatchBoard = {
    summary: { ...EMPTY_SEASON_SUMMARY },
    upcoming: [],
    recent: [],
    all: [],
  };
  if (!sid) return empty;

  const validIds = await fetchValidSeasonMatchIds(sid, {
    includeOrphanMatches: opts?.includeOrphanMatches === true,
  });
  if (validIds.size === 0) return empty;

  const [matchesRes, isHomeByMatchId, eventMetaByMatchId] = await Promise.all([
    supabase
      .from('matches')
      .select('id, opponent, match_date, status, score_home, score_away, location')
      .eq('team_season_id', sid)
      .in('id', [...validIds])
      .order('match_date', { ascending: false }),
    fetchIsHomeByMatchId(sid, validIds),
    fetchEventMetaByMatchId(sid, validIds),
  ]);

  if (matchesRes.error) return empty;

  const rows = ((matchesRes.data ?? []) as BoardMatchRow[]).filter((row) => validIds.has(row.id));

  const all: SeasonMatchCardData[] = rows.map((row) => {
    const isHome = isHomeByMatchId.get(row.id) ?? eventMetaByMatchId.get(row.id)?.isHome ?? null;
    const detail = resolveCoachMatchDetail(row, isHome);
    const eventMeta = eventMetaByMatchId.get(row.id);
    const location = (eventMeta?.location ?? row.location ?? '').trim() || null;
    return {
      ...detail,
      eventId: eventMeta?.eventId ?? null,
      location,
      isHome,
      displayStatus: resolveDisplayStatus(detail, row.status),
    };
  });

  const finished = all.filter((m) => m.outcome != null);
  const summary = computeSeasonMatchSummary(finished);

  const upcoming = all
    .filter((m) => m.outcome == null && m.displayStatus !== 'live')
    .sort(compareMatchDateAsc);

  const live = all.filter((m) => m.displayStatus === 'live').sort(compareMatchDateAsc);

  const upcomingOrdered = [...live, ...upcoming];

  const recent = finished
    .sort(compareMatchDateDesc)
    .slice(0, recentLimit > 0 ? recentLimit : undefined);

  return {
    summary,
    upcoming: upcomingOrdered,
    recent,
    all: [...all].sort(compareMatchDateDesc),
  };
}
