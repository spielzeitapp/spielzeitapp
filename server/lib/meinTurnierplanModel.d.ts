export function parseMeinTurnierplanModel(
  data: unknown,
): import("../../src/lib/tournamentPlanImport").TournamentPlanAnalysis | null;
export function inferMeinTurnierplanPhase(
  mapping: unknown,
  a?: unknown,
  b?: unknown,
): import("../../src/lib/tournamentPlanImport").TournamentMatchPhase;
export function meinTurnierplanLiveByMatchId(
  analysis: import("../../src/lib/tournamentPlanImport").TournamentPlanAnalysis | null | undefined,
): Map<string, import("../../src/lib/tournamentPlanImport").TournamentPlanImportRawMatch>;

export function resolveMeinTurnierplanFinalStandings(
  analysis: import("../../src/lib/tournamentPlanImport").TournamentPlanAnalysis,
): Array<{ rank: number; teamName: string }>;
