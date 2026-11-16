import type { FieldSlotId } from '../types/match';

/** Bench assignment replaces; moving an on-field player swaps occupied positions. */
export function moveTournamentLineupPlayer(
  slots: Record<FieldSlotId, string | null>, playerId: string, target: FieldSlotId | null,
): Record<FieldSlotId, string | null> {
  const next = { ...slots };
  const source = (Object.keys(next) as FieldSlotId[]).find(slot => next[slot] === playerId);
  if (source === target) return next;
  const displaced = target ? next[target] : null;
  for (const slot of Object.keys(next) as FieldSlotId[]) {
    if (next[slot] === playerId) next[slot] = null;
  }
  if (target) next[target] = playerId;
  if (source && target) next[source] = displaced;
  return next;
}
