/**
 * Einheitliche Live-Pitch-Slots: Replay (Kickoff + Events) mit DB-`match_lineup` abgleichen,
 * damit Trainer und Zuschauer dieselbe Feldbelegung sehen, falls Replay und DB kurz auseinanderlaufen.
 */

import type { FieldSlotId } from '../types/match';
import {
  dedupeFieldSlotMap,
  FIELD_SLOT_ORDER,
  startingLineupToSlotMap,
} from './matchEngine';

export function mergeLivePitchSlotsFromDb(
  replaySlots: Record<FieldSlotId, string | null>,
  dbStartingIdsFromLineupFetch: ReadonlyArray<string | null | undefined>,
): Record<FieldSlotId, string | null> {
  const dbMap = dedupeFieldSlotMap(startingLineupToSlotMap(dbStartingIdsFromLineupFetch.map((x) => String(x ?? '').trim())));
  const out = { ...replaySlots } as Record<FieldSlotId, string | null>;
  const used = new Set<string>();
  for (const s of FIELD_SLOT_ORDER) {
    const r = String(out[s] ?? '').trim();
    if (r) used.add(r);
  }
  for (const s of FIELD_SLOT_ORDER) {
    const r = String(out[s] ?? '').trim();
    if (r) continue;
    const d = String(dbMap[s] ?? '').trim();
    if (!d || used.has(d)) continue;
    out[s] = d;
    used.add(d);
  }
  for (const s of FIELD_SLOT_ORDER) {
    const r = String(out[s] ?? '').trim();
    if (r) continue;
    for (const s2 of FIELD_SLOT_ORDER) {
      const d = String(dbMap[s2] ?? '').trim();
      if (!d || used.has(d)) continue;
      out[s] = d;
      used.add(d);
      break;
    }
  }
  return dedupeFieldSlotMap(out);
}

export function countOccupiedFieldSlots(slots: Record<FieldSlotId, string | null>): number {
  let n = 0;
  for (const s of FIELD_SLOT_ORDER) {
    if (String(slots[s] ?? '').trim()) n += 1;
  }
  return n;
}
