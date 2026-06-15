import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchValidSeasonMatchIds } from "../lib/seasonMatchStats";
import { countPastTeamTrainings } from "../lib/trainingSeasonCounts";

export type TeamSeasonCoachStats = {
  trainings: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsPerGame: string;
};

const EMPTY_STATS: TeamSeasonCoachStats = {
  trainings: 0,
  matches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  pointsPerGame: "–",
};

type MatchRow = {
  id: string;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeFromMatches(
  rows: MatchRow[],
  isHomeByMatchId: Map<string, boolean | null>,
): Omit<TeamSeasonCoachStats, "trainings"> {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let pointsTotal = 0;
  let finishedWithResult = 0;

  for (const m of rows) {
    const st = (m.status ?? "").trim().toLowerCase();
    if (st !== "finished") continue;

    const sh = toNum(m.score_home);
    const sa = toNum(m.score_away);
    if (sh == null || sa == null) continue;

    const isHome = isHomeByMatchId.get(m.id) ?? true;
    const teamGoals = isHome ? sh : sa;
    const oppGoals = isHome ? sa : sh;

    goalsFor += teamGoals;
    goalsAgainst += oppGoals;
    finishedWithResult += 1;

    if (teamGoals > oppGoals) {
      wins += 1;
      pointsTotal += 3;
    } else if (teamGoals === oppGoals) {
      draws += 1;
      pointsTotal += 1;
    } else {
      losses += 1;
    }
  }

  const pointsPerGame =
    finishedWithResult > 0 ? (pointsTotal / finishedWithResult).toFixed(2) : "–";

  return {
    matches: finishedWithResult,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    pointsPerGame,
  };
}

async function fetchIsHomeByMatchId(
  teamSeasonId: string,
  validMatchIds: Set<string>,
): Promise<Map<string, boolean | null>> {
  const isHomeByMatchId = new Map<string, boolean | null>();

  const { data: matchEvents, error: matchEvErr } = await supabase
    .from("events")
    .select("match_id, is_home")
    .eq("team_season_id", teamSeasonId)
    .eq("kind", "match")
    .not("match_id", "is", null);

  if (!matchEvErr) {
    for (const ev of matchEvents ?? []) {
      const mid = (ev as { match_id?: string | null }).match_id;
      if (mid && validMatchIds.has(String(mid))) {
        isHomeByMatchId.set(String(mid), (ev as { is_home?: boolean | null }).is_home ?? null);
      }
    }
  }

  const { data: tmRows, error: tmErr } = await supabase
    .from("tournament_matches")
    .select("match_id, tournament_event_id")
    .in("match_id", [...validMatchIds]);

  if (!tmErr && (tmRows ?? []).length > 0) {
    const tournamentEventIds = [...new Set((tmRows ?? []).map((r) => (r as { tournament_event_id: string }).tournament_event_id))];
    const { data: tourEvents } = await supabase
      .from("events")
      .select("id, is_home")
      .in("id", tournamentEventIds);

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

export function useTeamSeasonCoachStats(teamSeasonId: string | null) {
  const [stats, setStats] = useState<TeamSeasonCoachStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!teamSeasonId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [trainings, validMatchIds] = await Promise.all([
        countPastTeamTrainings(teamSeasonId),
        fetchValidSeasonMatchIds(teamSeasonId),
      ]);

      if (validMatchIds.size === 0) {
        setStats({ ...EMPTY_STATS, trainings });
        setError(null);
        setLoading(false);
        return;
      }

      const [matchesRes, isHomeByMatchId] = await Promise.all([
        supabase
          .from("matches")
          .select("id, status, score_home, score_away")
          .eq("team_season_id", teamSeasonId)
          .in("id", [...validMatchIds]),
        fetchIsHomeByMatchId(teamSeasonId, validMatchIds),
      ]);

      if (matchesRes.error) {
        setStats({ ...EMPTY_STATS, trainings });
        setError(matchesRes.error.message);
        setLoading(false);
        return;
      }

      const matchRows = ((matchesRes.data ?? []) as MatchRow[]).filter((row) =>
        validMatchIds.has(row.id),
      );
      const matchStats = computeFromMatches(matchRows, isHomeByMatchId);
      setStats({ trainings, ...matchStats });
      setError(null);
    } catch (e) {
      setStats(EMPTY_STATS);
      setError(e instanceof Error ? e.message : "Statistik konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { stats, loading, error, refetch };
}

export function staffRoleWatermarkCode(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "head_coach") return "CH";
  if (r === "co_trainer") return "CT";
  return "TR";
}
