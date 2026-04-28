import type { FieldSlotId } from '../types/match';

/** Sichtbare 7er-Systeme (U11); Speicherung bleibt über FieldSlotId in match_lineup. */
export type U11FormationId = '1-2-2-2' | '1-2-3-1' | '1-3-2-1';

export const DEFAULT_U11_FORMATION: U11FormationId = '1-2-2-2';

export const U11_FORMATION_CHOICES: U11FormationId[] = ['1-2-2-2', '1-2-3-1', '1-3-2-1'];

export type FormationSlotLayout = {
  /** Persistierter Slot (match_lineup / Engine) */
  slot: FieldSlotId;
  /** Kurz-Label auf dem Feld (kann von Standard LV/LA abweichen) */
  label: string;
  x: number;
  y: number;
  /** Optionaler Label-Offset (nur UI, in px) gegen Kollisionen auf kleinen Screens */
  labelDx?: number;
  labelDy?: number;
};

/**
 * Koordinaten in Prozent (0–100): x von links, y von oben.
 * Zuordnung zu FieldSlotId wie in den Kommentaren — nur Darstellung, keine DB-Änderung.
 */
/** Gleichmäßige Reihen: Sturm ~21, MF ~45, Abwehr ~67, TW ~83 (Abstand zum Rand) */
export const U11_FORMATIONS: Record<U11FormationId, FormationSlotLayout[]> = {
  '1-2-2-2': [
    { slot: 'GK', label: 'GK', x: 50, y: 84, labelDy: 5 },
    { slot: 'LB', label: 'LV', x: 34, y: 68, labelDx: -4, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 66, y: 68, labelDx: 4, labelDy: 3 },
    { slot: 'LW', label: 'LM', x: 34, y: 45, labelDx: -4, labelDy: 3 },
    { slot: 'RW', label: 'RM', x: 66, y: 45, labelDx: 4, labelDy: 3 },
    { slot: 'CM', label: 'LS', x: 36, y: 22, labelDx: -4, labelDy: 3 },
    { slot: 'ST', label: 'RS', x: 64, y: 22, labelDx: 4, labelDy: 3 },
  ],
  '1-2-3-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 84, labelDy: 5 },
    { slot: 'LB', label: 'LV', x: 30, y: 68, labelDx: -4, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 70, y: 68, labelDx: 4, labelDy: 3 },
    { slot: 'LW', label: 'LA', x: 22, y: 45, labelDx: -5, labelDy: 3 },
    { slot: 'CM', label: 'ZM', x: 50, y: 45, labelDy: 3 },
    { slot: 'RW', label: 'RA', x: 78, y: 45, labelDx: 5, labelDy: 3 },
    { slot: 'ST', label: 'ST', x: 50, y: 22, labelDy: 3 },
  ],
  '1-3-2-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 84, labelDy: 5 },
    { slot: 'LB', label: 'LV', x: 22, y: 65, labelDx: -5, labelDy: 3 },
    { slot: 'CM', label: 'IV', x: 50, y: 68, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 78, y: 65, labelDx: 5, labelDy: 3 },
    { slot: 'LW', label: 'LZM', x: 34, y: 42, labelDx: -4, labelDy: 3 },
    { slot: 'RW', label: 'RZM', x: 66, y: 42, labelDx: 4, labelDy: 3 },
    { slot: 'ST', label: 'ST', x: 50, y: 21, labelDy: 3 },
  ],
};

const FALLBACK_LABELS: Record<FieldSlotId, string> = {
  GK: 'GK',
  LB: 'LV',
  RB: 'RV',
  CM: 'ZM',
  LW: 'LA',
  RW: 'RA',
  ST: 'ST',
};

export function isU11FormationId(v: string | null | undefined): v is U11FormationId {
  return v === '1-2-2-2' || v === '1-2-3-1' || v === '1-3-2-1';
}

export function labelForSlotInFormation(formationId: U11FormationId, storageSlot: FieldSlotId): string {
  const row = U11_FORMATIONS[formationId].find((r) => r.slot === storageSlot);
  return row?.label ?? FALLBACK_LABELS[storageSlot];
}

const FORMATION_STORAGE_PREFIX = 'spielzeit:u11formation:';

export function readStoredU11Formation(matchId: string | null | undefined): U11FormationId | null {
  if (!matchId?.trim()) return null;
  try {
    const v = localStorage.getItem(FORMATION_STORAGE_PREFIX + matchId.trim());
    if (isU11FormationId(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredU11Formation(matchId: string, formationId: U11FormationId): void {
  if (!matchId?.trim()) return;
  try {
    localStorage.setItem(FORMATION_STORAGE_PREFIX + matchId.trim(), formationId);
  } catch {
    /* ignore */
  }
}
