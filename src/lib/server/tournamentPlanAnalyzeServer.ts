/**
 * Server/API-Einstieg für Turnierplan-Analyse — ohne Supabase/React/Browser-Storage.
 * Vercel Functions importieren nur aus diesem Modul.
 */
export { captureMeinTurnierplanHtmlFallbackException } from '../meinTurnierplanHtmlFallback';
export {
  analyzeMeinTurnierplanUrl,
  analyzeMeinTurnierplanUrlForceHtmlFallback,
  buildMeinTurnierplanJsonEndpoints,
  buildMeinTurnierplanShowitUrl,
  buildTournamentPlanAnalyzeFailure,
  captureMeinTurnierplanFetchException,
  extractMeinTurnierplanId,
  isSupportedTournamentPlanHost,
  normalizeTournamentPlanUrl,
  MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  tryMeinTurnierplanHtmlFallbackAnalyze,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
  type TournamentPlanFetchRuntimeDiagnostics,
} from '../tournamentPlanImport';
