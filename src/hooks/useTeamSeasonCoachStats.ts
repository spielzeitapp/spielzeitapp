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
      const [trainings, validMatchIds, matchesRes, matchEventsRes] = await Promise.all([
        countPastTeamTrainings(teamSeasonId),
        fetchValidSeasonMatchIds(teamSeasonId),
        supabase
          .from("matches")
          .select("id, status, score_home, score_away")
          .eq("team_season_id", teamSeasonId),
        supabase
          .from("events")
          .select("match_id, is_home")
          .eq("team_season_id", teamSeasonId)
          .eq("kind", "match")
          .not("match_id", "is", null),
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
      const isHomeByMatchId = new Map<string, boolean | null>();
      if (!matchEventsRes.error) {
        for (const ev of matchEventsRes.data ?? []) {
          const mid = (ev as { match_id?: string | null }).match_id;
          if (mid && validMatchIds.has(String(mid))) {
            isHomeByMatchId.set(String(mid), (ev as { is_home?: boolean | null }).is_home ?? null);
          }
        }
      }

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
