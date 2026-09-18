import type { U11FormationId } from './matchFormations';
import type { FieldSlotId } from '../types/match';

export type MatchLineupVariantNumber = 1 | 2;

export type MatchLineupVariantDraft = {
  slots: Record<FieldSlotId, string | null>;
  squadIds: string[];
  formationId: U11FormationId;
};

export type StoredMatchLineupVariants = {
  version: 1;
  startVariant: MatchLineupVariantNumber;
  variants: Record<MatchLineupVariantNumber, MatchLineupVariantDraft>;
};

const storageKey = (matchId: string): string => `spielzeit:match-lineup-variants:v1:${matchId}`;

export function cloneMatchLineupVariant(draft: MatchLineupVariantDraft): MatchLineupVariantDraft {
  return {
    slots: { ...draft.slots },
    squadIds: [...draft.squadIds],
    formationId: draft.formationId,
  };
}

/**
 * Eine lokal gespeicherte Variante darf die aktuelle Kaderauswahl aus Supabase
 * nicht verkleinern. Entfernte Spieler verschwinden aus den Slots; neu
 * nominierte Spieler bleiben im Kader und erscheinen dadurch auf der Bank.
 */
export function reconcileMatchLineupVariantSquad(
  draft: MatchLineupVariantDraft,
  currentSquadIds: readonly string[],
): MatchLineupVariantDraft {
  const squadIds = [
    ...new Set(currentSquadIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
  ];
  const squadSet = new Set(squadIds);
  const slots = { ...draft.slots };

  for (const slot of Object.keys(slots) as FieldSlotId[]) {
    const playerId = String(slots[slot] ?? '').trim();
    slots[slot] = playerId && squadSet.has(playerId) ? playerId : null;
  }

  return {
    slots,
    squadIds,
    formationId: draft.formationId,
  };
}

export function readMatchLineupVariants(matchId: string): StoredMatchLineupVariants | null {
  try {
    const raw = window.localStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMatchLineupVariants>;
    if (parsed.version !== 1 || (parsed.startVariant !== 1 && parsed.startVariant !== 2)) return null;
    if (!parsed.variants?.[1] || !parsed.variants?.[2]) return null;
    return parsed as StoredMatchLineupVariants;
  } catch {
    return null;
  }
}

export function writeMatchLineupVariants(matchId: string, value: StoredMatchLineupVariants): void {
  try {
    window.localStorage.setItem(storageKey(matchId), JSON.stringify(value));
  } catch {
    // Die kanonische Startaufstellung bleibt weiterhin in Supabase gespeichert.
  }
}
