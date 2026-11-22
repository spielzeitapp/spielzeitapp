export function parseMeinTurnierplanModel(
  data: unknown,
): import("../../src/lib/tournamentPlanImport").TournamentPlanAnalysis | null;
export function inferMeinTurnierplanPhase(
  mapping: unknown,
  a?: unknown,
  b?: unknown,
): import("../../src/lib/tournamentPlanImport").TournamentMatchPhase;
export function meinTurnierplanLiveByMatchId(analysis: unknown): Map<
  string | null | undefined,
  { liveHomeGoals?: number | null; liveAwayGoals?: number | null }
>;
