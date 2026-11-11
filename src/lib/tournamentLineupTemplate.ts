import {
  U11_FORMATIONS,
  U11_FORMATION_CHOICES,
  type U11FormationId,
} from "./matchFormations";
import type { StoredMatchLineupVariants } from "./matchLineupVariants";
import type { FieldSlotId } from "../types/match";
export const templateEmptySlots = (): Record<FieldSlotId, string | null> => ({
  GK: null,
  LB: null,
  RB: null,
  CM: null,
  LW: null,
  RW: null,
  ST: null,
  FP: null,
});
export function emptyTournamentTemplate(
  squadIds: string[],
  formationId: U11FormationId = "1-2-2",
): StoredMatchLineupVariants {
  return {
    version: 1,
    startVariant: 1,
    variants: {
      1: { formationId, slots: templateEmptySlots(), squadIds: [...squadIds] },
      2: { formationId, slots: templateEmptySlots(), squadIds: [...squadIds] },
    },
  };
}
export function tournamentTemplateReady(
  value: StoredMatchLineupVariants | null,
  squad: readonly string[],
  unavailable: readonly string[] = [],
): boolean {
  if (!value || value.version !== 1 || ![1, 2].includes(value.startVariant))
    return false;
  let count: number | undefined;
  return ([1, 2] as const).every((n) => {
    const d = value.variants?.[n];
    if (
      !d ||
      !U11_FORMATION_CHOICES.includes(
        d.formationId as (typeof U11_FORMATION_CHOICES)[number],
      )
    )
      return false;
    if (
      !Array.isArray(d.squadIds) ||
      d.squadIds.length !== squad.length ||
      new Set(d.squadIds).size !== squad.length ||
      d.squadIds.some((id) => !squad.includes(id))
    )
      return false;
    const layout = U11_FORMATIONS[d.formationId];
    const ids = layout.map((x) => d.slots?.[x.slot]);
    if (count !== undefined && count !== layout.length) return false;
    count = layout.length;
    return (
      ids.every((id): id is string =>
        Boolean(id && squad.includes(id) && !unavailable.includes(id)),
      ) &&
      new Set(ids).size === ids.length &&
      Object.entries(d.slots).every(
        ([s, id]) => !id || layout.some((x) => x.slot === s),
      )
    );
  });
}
