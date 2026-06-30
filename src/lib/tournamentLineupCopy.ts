import {
  fetchLineupForLiveMatch,
  fetchMatchById,
  replaceMatchLineupAndBench,
  saveMatchSquadOnly,
  updateMatchRow,
  type LineupLoadResult,
} from './liveMatchService';
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

/** Letztes beendetes Turnierspiel mit gespeicherter Aufstellung (relativ zum nächsten offenen Slot). */
export function pickPreviousFinishedMatchWithLineup(
  slots: TournamentMatchSlotView[],
  nextSlot: TournamentMatchSlotView,
): TournamentMatchSlotView | null {
  const ordered = sortTournamentSlotsChronologically(slots);
  const nextIdx = ordered.findIndex((s) => s.id === nextSlot.id);
  if (nextIdx <= 0) return null;

  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if ((slot.match_status ?? '').toLowerCase() !== 'finished') continue;
    if (slot.has_lineup || slot.has_squad) return slot;
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
};

export async function detectTournamentLineupCopyContext(
  slots: TournamentMatchSlotView[],
  targetSlot: TournamentMatchSlotView,
): Promise<TournamentLineupCopyContext | null> {
  const sourceSlot = pickPreviousFinishedMatchWithLineup(slots, targetSlot);
  if (!sourceSlot) return null;

  const targetMatchId = targetSlot.match_id?.trim() ?? '';
  if (!targetMatchId) return null;

  const { data: targetLineup, error } = await fetchLineupForLiveMatch(targetMatchId);
  if (error) return null;

  const targetLineupEmpty = isTournamentMatchLineupEmpty(targetLineup);
  const targetHasExistingLineup = !targetLineupEmpty;

  return {
    sourceSlot,
    targetSlot,
    targetLineupEmpty,
    targetHasExistingLineup,
  };
}

async function copyFormationIfPresent(sourceMatchId: string, targetMatchId: string): Promise<void> {
  const { data: source } = await fetchMatchById(sourceMatchId);
  const formationId = String(source?.u11_formation_id ?? '').trim();
  if (!formationId) return;
  await updateMatchRow(targetMatchId, { u11_formation_id: formationId });
}

export async function copyTournamentLineupBetweenMatches(params: {
  sourceMatchId: string;
  targetMatchId: string;
  mode: TournamentLineupCopyMode;
  tournamentEventId?: string;
  replaceExisting?: boolean;
}): Promise<{ error: string | null }> {
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
    return saveMatchSquadOnly(targetMatchId, squadRes.data);
  }

  const { data: sourceLineup, error: sourceErr } = await fetchLineupForLiveMatch(sourceMatchId);
  if (sourceErr) return { error: sourceErr };

  const starters = [...sourceLineup.startingPlayerIds];
  const bench = [...sourceLineup.savedBenchPlayerIds];
  const fullSquad = [...new Set([...sourceLineup.squadPlayerIds])];

  switch (params.mode) {
    case 'full': {
      const err = (
        await replaceMatchLineupAndBench(targetMatchId, starters, fullSquad, {
          benchPlayerIds: bench,
        })
      ).error;
      if (err) return { error: err };
      await copyFormationIfPresent(sourceMatchId, targetMatchId);
      return { error: null };
    }
    case 'starters': {
      const starterIds = starters.filter((id) => String(id ?? '').trim().length > 0);
      const err = (await replaceMatchLineupAndBench(targetMatchId, starters, starterIds)).error;
      if (err) return { error: err };
      await copyFormationIfPresent(sourceMatchId, targetMatchId);
      return { error: null };
    }
    case 'bench': {
      const emptyStarters = starters.map(() => '');
      const err = (
        await replaceMatchLineupAndBench(targetMatchId, emptyStarters, bench, {
          benchPlayerIds: bench,
        })
      ).error;
      return { error: err };
    }
    default:
      return { error: 'Unbekannter Kopiermodus.' };
  }
}
