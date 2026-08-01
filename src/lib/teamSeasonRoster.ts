/**
 * Kompatibilitäts-Exports (STEP 3 Helper → STEP 4 rosterService).
 * Neue Imports bitte direkt aus `rosterService` nehmen.
 */
export {
  listRoster as listTeamSeasonRoster,
  shouldUseRosterJoin,
  compareRosterPaths,
  type RosterPlayer as TeamSeasonRosterRow,
} from './rosterService';
