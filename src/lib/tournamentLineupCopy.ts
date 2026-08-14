import {
  fetchLineupForLiveMatch,
  fetchMatchById,
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
import {
  pickLastFinishedTournamentSlot,
  sortTournamentSlotsChronologically,
} from './tournamentDayOrchestrator';
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

function countFilledStarters(lineup: LineupLoadResult): number {
  return lineup.startingPlayerIds.filter((id) => String(id ?? '').trim().length > 0).length;
}

function finishedStatus(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'finished' || s === 'ended' || s === 'completed';
}

/** Letztes beendetes Turnierspiel mit gespeicherter Startelf (relativ zum nächsten offenen Slot). */
export function pickPreviousFinishedMatchWithLineup(
  slots: TournamentMatchSlotView[],
  nextSlot: TournamentMatchSlotView,
): TournamentMatchSlotView | null {
  const ordered = sortTournamentSlotsChronologically(slots);
  const nextIdx = ordered.findIndex((s) => s.id === nextSlot.id);
  if (nextIdx <= 0) return null;

  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if (!finishedStatus(slot.match_status)) continue;
    if (slot.has_lineup) return slot;
  }

  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if (!finishedStatus(slot.match_status)) continue;
    if (slot.has_squad) return slot;
  }

  const last = pickLastFinishedTournamentSlot(slots);
  if (!last || last.id === nextSlot.id) return null;
  return last.has_lineup || last.has_squad ? last : null;
}

export type TournamentLineupCopyContext = {
  sourceSlot: TournamentMatchSlotView;
  targetSlot: TournamentMatchSlotView;
  targetLineupEmpty: boolean;
  targetHasExistingLineup: boolean;
  sourceHasCompleteLineup: boolean;
  sourceStarterCount: number;
};

export async function detectTournamentLineupCopyContext(
  slots: TournamentMatchSlotView[],
  targetSlot: TournamentMatchSlotView,
): Promise<TournamentLineupCopyContext | null> {
  const candidates: TournamentMatchSlotView[] = [];
  const ordered = sortTournamentSlotsChronologically(slots);
  const nextIdx = ordered.findIndex((s) => s.id === targetSlot.id);
  if (nextIdx > 0) {
    for (let i = nextIdx - 1; i >= 0; i -= 1) {
      const slot = ordered[i];
      if (!finishedStatus(slot.match_status)) continue;
      if (!slot.match_id?.trim()) continue;
      candidates.push(slot);
    }
  }
  if (candidates.length === 0) {
    const fallback = pickPreviousFinishedMatchWithLineup(slots, targetSlot);
    if (fallback?.match_id?.trim()) candidates.push(fallback);
  }

  const targetMatchId = targetSlot.match_id?.trim() ?? '';
  if (!targetMatchId || candidates.length === 0) return null;

  const { data: targetLineup, error } = await fetchLineupForLiveMatch(targetMatchId);
  if (error) return null;

  const targetLineupEmpty = isTournamentMatchLineupEmpty(targetLineup);
  const targetHasExistingLineup = !targetLineupEmpty;

  for (const sourceSlot of candidates) {
    const sourceMatchId = sourceSlot.match_id?.trim() ?? '';
    if (!sourceMatchId) continue;
    const { data: sourceLineup, error: sourceErr } = await fetchLineupForLiveMatch(sourceMatchId);
    if (sourceErr) continue;
    const starterCount = countFilledStarters(sourceLineup);
    if (starterCount < 1 && sourceLineup.savedBenchPlayerIds.length === 0) continue;
    return {
      sourceSlot,
      targetSlot,
      targetLineupEmpty,
      targetHasExistingLineup,
      sourceHasCompleteLineup: isTournamentMatchLineupComplete(sourceLineup),
      sourceStarterCount: starterCount,
    };
  }

  return null;
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
    if (actualFilled.length < expectedFilled.length) {
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

  const targetEmpty = isTournamentMatchLineupEmpty(targetLineup);
  if (!targetEmpty && !params.replaceExisting) {
    return { error: 'Aufstellung ist bereits vorhanden.' };
  }

  if (params.mode === 'squad_only') {
    const eventId = params.tournamentEventId?.trim() ?? '';
    if (!eventId) return { error: 'Turnier-Event fehlt.' };
    const squadRes = await fetchTournamentSquadPlayerIds(eventId);
    if (squadRes.error) return { error: squadRes.error };
    if (squadRes.data.length === 0) return { error: 'Kein Turnierkader hinterlegt.' };
    const saveErr = (await saveMatchSquadOnly(targetMatchId, squadRes.data)).error;
    return { error: saveErr };
  }

  const { data: sourceLineup, error: sourceErr } = await fetchLineupForLiveMatch(sourceMatchId);
  if (sourceErr) return { error: sourceErr };

  const starters = [...sourceLineup.startingPlayerIds];
  const bench = [...sourceLineup.savedBenchPlayerIds];
  const starterIds = starters.filter((id) => String(id ?? '').trim().length > 0);
  const fullSquad = [...new Set([...sourceLineup.squadPlayerIds, ...starterIds, ...bench])];

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
