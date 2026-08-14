import {
  fetchKickoffLineupPlayerIds,
  fetchLineupForLiveMatch,
  fetchMatchById,
  LIVE_FIELD_SLOT_ORDER,
  replaceMatchLineupAndBench,
  saveMatchSquadOnly,
  updateMatchRow,
  type LineupLoadResult,
} from './liveMatchService';
import {
  isU11FormationId,
  readStoredU11Formation,
  writeStoredU11Formation,
  type U11FormationId,
} from './matchFormations';
import { isStartelfCompleteFromStartingIds } from '../pages/MatchDetail/lineupGuards';
import { sortTournamentSlotsChronologically } from './tournamentDayOrchestrator';
import type { TournamentMatchSlotView } from './tournamentPlan';
import { fetchTournamentSquadPlayerIds } from './tournamentSquad';

export type TournamentLineupCopyMode = 'full' | 'starters' | 'bench' | 'squad_only';

export function isTournamentMatchLineupEmpty(lineup: LineupLoadResult): boolean {
  const hasField = lineup.startingPlayerIds.some((id) => String(id ?? '').trim().length > 0);
  const hasBench = lineup.savedBenchPlayerIds.some((id) => String(id ?? '').trim().length > 0);
  return !hasField && !hasBench;
}

export function isTournamentMatchLineupComplete(lineup: LineupLoadResult): boolean {
  return isStartelfCompleteFromStartingIds(lineup.startingPlayerIds);
}

function countFilledStarters(startingPlayerIds: readonly (string | null | undefined)[]): number {
  return startingPlayerIds.filter((id) => String(id ?? '').trim().length > 0).length;
}

function finishedStatus(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'finished' || s === 'ended' || s === 'completed';
}

function isOwnTournamentSlot(slot: TournamentMatchSlotView): boolean {
  return slot.is_own_team !== false;
}

/**
 * Unmittelbar vorheriges eigenes, beendetes Turnierspiel (chronologisch).
 * Generisch für Spiel 1→2, 2→3, Gruppe→KO.
 */
export function pickImmediatePreviousOwnFinishedSlot(
  slots: TournamentMatchSlotView[],
  nextSlot: TournamentMatchSlotView,
): TournamentMatchSlotView | null {
  const ordered = sortTournamentSlotsChronologically(slots).filter(isOwnTournamentSlot);
  const nextIdx = ordered.findIndex((s) => s.id === nextSlot.id);
  if (nextIdx <= 0) return null;

  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if (!finishedStatus(slot.match_status)) continue;
    if (!slot.match_id?.trim()) continue;
    return slot;
  }
  return null;
}

/** @deprecated Alias — nutzt jetzt immediate previous own finished. */
export function pickPreviousFinishedMatchWithLineup(
  slots: TournamentMatchSlotView[],
  nextSlot: TournamentMatchSlotView,
): TournamentMatchSlotView | null {
  return pickImmediatePreviousOwnFinishedSlot(slots, nextSlot);
}

export type TournamentLineupCopyContext = {
  sourceSlot: TournamentMatchSlotView;
  targetSlot: TournamentMatchSlotView;
  targetLineupEmpty: boolean;
  targetHasExistingLineup: boolean;
  sourceHasCompleteLineup: boolean;
  sourceStarterCount: number;
  sourceOpponentName: string;
};

/** Source-Startelf: match_lineup, sonst Kickoff-Snapshot (nach Spielende oft nur Bank in match_lineup). */
export async function resolveSourceLineupForCopy(
  sourceMatchId: string,
): Promise<{ data: LineupLoadResult; starterCount: number; error: string | null }> {
  const { data, error } = await fetchLineupForLiveMatch(sourceMatchId);
  if (error) {
    return {
      data: { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] },
      starterCount: 0,
      error,
    };
  }

  let startingPlayerIds = [...data.startingPlayerIds];
  let starterCount = countFilledStarters(startingPlayerIds);

  if (starterCount < 1) {
    const kickoff = await fetchKickoffLineupPlayerIds(sourceMatchId);
    if (kickoff && countFilledStarters(kickoff) > 0) {
      startingPlayerIds = LIVE_FIELD_SLOT_ORDER.map((_, i) => String(kickoff[i] ?? '').trim());
      starterCount = countFilledStarters(startingPlayerIds);
    }
  }

  const starterIds = startingPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean);
  const bench = data.savedBenchPlayerIds.filter((id) => !starterIds.includes(id));
  const squadPlayerIds = [...new Set([...data.squadPlayerIds, ...starterIds, ...bench])];

  return {
    data: {
      startingPlayerIds,
      squadPlayerIds,
      savedBenchPlayerIds: bench.length > 0 ? bench : data.savedBenchPlayerIds,
    },
    starterCount,
    error: null,
  };
}

export async function detectTournamentLineupCopyContext(
  slots: TournamentMatchSlotView[],
  targetSlot: TournamentMatchSlotView,
): Promise<TournamentLineupCopyContext | null> {
  const sourceSlot = pickImmediatePreviousOwnFinishedSlot(slots, targetSlot);
  if (!sourceSlot) return null;

  const sourceMatchId = sourceSlot.match_id?.trim() ?? '';
  const targetMatchId = targetSlot.match_id?.trim() ?? '';
  if (!sourceMatchId || !targetMatchId) return null;

  const { data: targetLineup, error } = await fetchLineupForLiveMatch(targetMatchId);
  if (error) return null;

  const targetLineupEmpty = isTournamentMatchLineupEmpty(targetLineup);
  // Nur Feld belegt = echte Aufstellung; nur Bank/Squad ohne Feld = Copy noch erlaubt.
  const targetHasField =
    countFilledStarters(targetLineup.startingPlayerIds) > 0;
  const targetHasExistingLineup = targetHasField;

  const sourceRes = await resolveSourceLineupForCopy(sourceMatchId);
  if (sourceRes.error || sourceRes.starterCount < 1) return null;

  return {
    sourceSlot,
    targetSlot,
    targetLineupEmpty,
    targetHasExistingLineup,
    sourceHasCompleteLineup: isTournamentMatchLineupComplete(sourceRes.data),
    sourceStarterCount: sourceRes.starterCount,
    sourceOpponentName: String(sourceSlot.opponent_name ?? '').trim() || 'Gegner',
  };
}

async function resolveSourceFormationId(sourceMatchId: string): Promise<U11FormationId | null> {
  const { data: source } = await fetchMatchById(sourceMatchId);
  const fromDb = String(source?.u11_formation_id ?? '').trim();
  if (isU11FormationId(fromDb)) return fromDb;
  const stored = readStoredU11Formation(sourceMatchId);
  return stored;
}

async function copyFormationIfPresent(
  sourceMatchId: string,
  targetMatchId: string,
): Promise<{ formationId: U11FormationId | null; error: string | null }> {
  const formationId = await resolveSourceFormationId(sourceMatchId);
  if (!formationId) return { formationId: null, error: null };
  const { error } = await updateMatchRow(targetMatchId, { u11_formation_id: formationId });
  if (error) return { formationId: null, error };
  writeStoredU11Formation(targetMatchId, formationId);
  return { formationId, error: null };
}

async function verifyCopiedLineup(
  targetMatchId: string,
  mode: TournamentLineupCopyMode,
  expectedStarters: string[],
  expectedBench: string[],
): Promise<string | null> {
  const { data, error } = await fetchLineupForLiveMatch(targetMatchId);
  if (error) return error;

  if (mode === 'full' || mode === 'starters') {
    const expectedFilled = expectedStarters.filter((id) => String(id ?? '').trim().length > 0);
    const actualFilled = data.startingPlayerIds.filter((id) => String(id ?? '').trim().length > 0);
    if (expectedFilled.length === 0) {
      return 'Aufstellung wurde nicht übernommen (keine Startelf).';
    }
    if (actualFilled.length < Math.min(7, expectedFilled.length)) {
      return 'Aufstellung wurde nicht vollständig übernommen.';
    }
  }
  if (mode === 'full' || mode === 'bench') {
    const expected = new Set(expectedBench.map((id) => id.trim()).filter(Boolean));
    const actual = new Set(data.savedBenchPlayerIds.map((id) => id.trim()).filter(Boolean));
    for (const id of expected) {
      if (!actual.has(id) && !data.startingPlayerIds.includes(id)) {
        return 'Ersatzbank wurde nicht vollständig übernommen.';
      }
    }
  }
  return null;
}

export async function copyTournamentLineupBetweenMatches(params: {
  sourceMatchId: string;
  targetMatchId: string;
  mode: TournamentLineupCopyMode;
  tournamentEventId?: string;
  replaceExisting?: boolean;
}): Promise<{ error: string | null; formationId?: string | null }> {
  const sourceMatchId = params.sourceMatchId.trim();
  const targetMatchId = params.targetMatchId.trim();
  if (!sourceMatchId || !targetMatchId) return { error: 'Spiel-IDs fehlen.' };

  const { data: targetLineup, error: targetErr } = await fetchLineupForLiveMatch(targetMatchId);
  if (targetErr) return { error: targetErr };

  const targetHasField = countFilledStarters(targetLineup.startingPlayerIds) > 0;
  if (targetHasField && !params.replaceExisting) {
    return { error: 'Aufstellung ist bereits vorhanden.' };
  }

  if (params.mode === 'squad_only') {
    const eventId = params.tournamentEventId?.trim() ?? '';
    if (!eventId) return { error: 'Turnier-Event fehlt.' };
    const squadRes = await fetchTournamentSquadPlayerIds(eventId);
    if (squadRes.error) return { error: squadRes.error };
    if (squadRes.data.length === 0) return { error: 'Kein Turnierkader hinterlegt.' };
    // Nur wenn Ziel noch keine Feldaufstellung hat — sonst nicht überschreiben.
    if (targetHasField && !params.replaceExisting) {
      return { error: 'Bestehende Aufstellung wird nicht überschrieben.' };
    }
    const saveErr = (await saveMatchSquadOnly(targetMatchId, squadRes.data)).error;
    return { error: saveErr };
  }

  const sourceRes = await resolveSourceLineupForCopy(sourceMatchId);
  if (sourceRes.error) return { error: sourceRes.error };

  const starters = [...sourceRes.data.startingPlayerIds];
  const bench = [...sourceRes.data.savedBenchPlayerIds];
  const starterIds = starters.filter((id) => String(id ?? '').trim().length > 0);
  const fullSquad = [...new Set([...sourceRes.data.squadPlayerIds, ...starterIds, ...bench])];

  if ((params.mode === 'full' || params.mode === 'starters') && starterIds.length === 0) {
    return { error: 'Im vorherigen Spiel ist keine Startelf gespeichert.' };
  }

  switch (params.mode) {
    case 'full': {
      const err = (
        await replaceMatchLineupAndBench(targetMatchId, starters, fullSquad, {
          benchPlayerIds: bench,
        })
      ).error;
      if (err) return { error: err };
      const formation = await copyFormationIfPresent(sourceMatchId, targetMatchId);
      if (formation.error) return { error: formation.error };
      const verifyErr = await verifyCopiedLineup(targetMatchId, 'full', starters, bench);
      if (verifyErr) return { error: verifyErr };
      return { error: null, formationId: formation.formationId };
    }
    case 'starters': {
      const err = (await replaceMatchLineupAndBench(targetMatchId, starters, starterIds)).error;
      if (err) return { error: err };
      const formation = await copyFormationIfPresent(sourceMatchId, targetMatchId);
      if (formation.error) return { error: formation.error };
      const verifyErr = await verifyCopiedLineup(targetMatchId, 'starters', starters, []);
      if (verifyErr) return { error: verifyErr };
      return { error: null, formationId: formation.formationId };
    }
    case 'bench': {
      const emptyStarters = starters.map(() => '');
      const err = (
        await replaceMatchLineupAndBench(targetMatchId, emptyStarters, bench, {
          benchPlayerIds: bench,
        })
      ).error;
      if (err) return { error: err };
      const verifyErr = await verifyCopiedLineup(targetMatchId, 'bench', [], bench);
      if (verifyErr) return { error: verifyErr };
      return { error: null };
    }
    default:
      return { error: 'Unbekannter Kopiermodus.' };
  }
}
