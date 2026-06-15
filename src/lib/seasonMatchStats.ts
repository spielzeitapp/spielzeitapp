import { supabase } from './supabaseClient';
import { isInactiveEventStatus } from './eventFilters';

/**
 * Match-IDs, die für Saisonsstatistik zählen:
 * - Liga/Freundschaftsspiel mit aktivem Event
 * - Turnierspiel mit aktivem Turnier-Event
 * Keine verwaisten Import-/Turnier-Leichen ohne Event.
 */
export async function fetchValidSeasonMatchIds(teamSeasonId: string): Promise<Set<string>> {
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
