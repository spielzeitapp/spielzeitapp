import type { FieldSlotId } from '../types/match';

/** 7er-Systeme (Normalspiel). */
export type U11SevenFormationId = '1-2-2-2' | '1-2-3-1' | '1-3-2-1' | '1-3-3';

/** 8er FairPlay-Systeme (Zusatzspieler im FP-Slot). */
export type FairPlayFormationId = '1-3-3-1' | '1-4-3' | '1-3-4';

export type U11FormationId = U11SevenFormationId | FairPlayFormationId;

export const DEFAULT_U11_FORMATION: U11SevenFormationId = '1-2-2-2';

/** Wenn `matches.u11_formation_id` NULL ist und kein gültiger lokaler Cache: einheitlicher Pitch-Fallback. */
export const U11_FORMATION_DB_FALLBACK: U11SevenFormationId = '1-2-3-1';

export const DEFAULT_FAIRPLAY_FORMATION: FairPlayFormationId = '1-4-3';

/** Normale 7er-Auswahl (Trainer vor Anpfiff / ohne FairPlay). */
export const U11_FORMATION_CHOICES: U11SevenFormationId[] = ['1-2-2-2', '1-2-3-1', '1-3-2-1', '1-3-3'];

/** FairPlay +1: nur 8er-Layouts mit echtem FP-Slot. */
export const FAIRPLAY_FORMATION_CHOICES: FairPlayFormationId[] = ['1-3-3-1', '1-4-3', '1-3-4'];

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
export const U11_FORMATIONS: Record<U11FormationId, FormationSlotLayout[]> = {
  '1-2-2-2': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 26, y: 71, labelDx: 5, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 74, y: 71, labelDx: -5, labelDy: 3 },
    { slot: 'LW', label: 'LM', x: 19, y: 40, labelDx: 6, labelDy: 2 },
    { slot: 'RW', label: 'RM', x: 81, y: 40, labelDx: -6, labelDy: 2 },
    { slot: 'CM', label: 'LS', x: 33, y: 17, labelDx: -3, labelDy: 1 },
    { slot: 'ST', label: 'RS', x: 67, y: 17, labelDx: 3, labelDy: 1 },
  ],
  '1-2-3-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -3 },
    { slot: 'LB', label: 'LV', x: 24, y: 70, labelDx: 4, labelDy: 0 },
    { slot: 'RB', label: 'RV', x: 76, y: 70, labelDx: -4, labelDy: 0 },
    { slot: 'LW', label: 'LA', x: 17, y: 36, labelDx: 4, labelDy: 2 },
    { slot: 'CM', label: 'ZM', x: 50, y: 48, labelDx: 0, labelDy: 1 },
    { slot: 'RW', label: 'RA', x: 83, y: 36, labelDx: -4, labelDy: 2 },
    { slot: 'ST', label: 'ST', x: 54, y: 16, labelDx: 3, labelDy: 1 },
  ],
  '1-3-2-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 14, y: 68, labelDx: 6, labelDy: 3 },
    { slot: 'CM', label: 'IV', x: 50, y: 71, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 86, y: 68, labelDx: -6, labelDy: 3 },
    { slot: 'LW', label: 'LZM', x: 28, y: 38, labelDx: -4, labelDy: 2 },
    { slot: 'RW', label: 'RZM', x: 72, y: 38, labelDx: 4, labelDy: 2 },
    { slot: 'ST', label: 'ST', x: 50, y: 14, labelDy: 1 },
  ],
  '1-3-3': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 14, y: 67, labelDx: 6, labelDy: 3 },
    { slot: 'CM', label: 'IV', x: 50, y: 70, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 86, y: 67, labelDx: -6, labelDy: 3 },
    { slot: 'LW', label: 'LF', x: 17, y: 24, labelDx: 6, labelDy: 1 },
    { slot: 'RW', label: 'RF', x: 83, y: 24, labelDx: -6, labelDy: 1 },
    { slot: 'ST', label: 'ST', x: 50, y: 12, labelDy: 0 },
  ],
  /** FairPlay: 1 TW + 3 hinten + 3 vorne + FP (8 Slots). */
  '1-3-3-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 14, y: 68, labelDx: 6, labelDy: 3 },
    { slot: 'CM', label: 'IV', x: 50, y: 71, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 86, y: 68, labelDx: -6, labelDy: 3 },
    { slot: 'LW', label: 'LF', x: 17, y: 24, labelDx: 6, labelDy: 1 },
    { slot: 'ST', label: 'ST', x: 50, y: 12, labelDy: 0 },
    { slot: 'RW', label: 'RF', x: 83, y: 24, labelDx: -6, labelDy: 1 },
    { slot: 'FP', label: 'FP', x: 62, y: 70, labelDx: 0, labelDy: 2 },
  ],
  /** FairPlay: 1 TW + 4 hinten (inkl. FP) + 3 vorne. */
  '1-4-3': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 16, y: 68, labelDx: 5, labelDy: 3 },
    { slot: 'FP', label: 'FP', x: 38, y: 70, labelDx: 0, labelDy: 2 },
    { slot: 'CM', label: 'IV', x: 62, y: 70, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 84, y: 68, labelDx: -5, labelDy: 3 },
    { slot: 'LW', label: 'LF', x: 17, y: 24, labelDx: 6, labelDy: 1 },
    { slot: 'RW', label: 'RF', x: 83, y: 24, labelDx: -6, labelDy: 1 },
    { slot: 'ST', label: 'ST', x: 50, y: 12, labelDy: 0 },
  ],
  /** FairPlay: 1 TW + 3 hinten + 4 vorne (inkl. FP). */
  '1-3-4': [
    { slot: 'GK', label: 'GK', x: 50, y: 86, labelDy: -5 },
    { slot: 'LB', label: 'LV', x: 14, y: 68, labelDx: 6, labelDy: 3 },
    { slot: 'CM', label: 'IV', x: 50, y: 71, labelDy: 3 },
    { slot: 'RB', label: 'RV', x: 86, y: 68, labelDx: -6, labelDy: 3 },
    { slot: 'LW', label: 'LF', x: 12, y: 22, labelDx: 5, labelDy: 1 },
    { slot: 'ST', label: 'ST', x: 50, y: 10, labelDy: 0 },
    { slot: 'RW', label: 'RF', x: 88, y: 22, labelDx: -5, labelDy: 1 },
    { slot: 'FP', label: 'FP', x: 68, y: 28, labelDx: -2, labelDy: 1 },
  ],
};

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  for (const fid of U11_FORMATION_CHOICES) {
    const rows = U11_FORMATIONS[fid];
    const slots = rows.map((r) => r.slot);
    if (rows.length !== 7 || new Set(slots).size !== 7) {
      throw new Error(`U11_FORMATIONS[${fid}] muss genau 7 eindeutige Slots haben.`);
    }
  }
  for (const fid of FAIRPLAY_FORMATION_CHOICES) {
    const rows = U11_FORMATIONS[fid];
    const slots = rows.map((r) => r.slot);
    if (rows.length !== 8 || new Set(slots).size !== 8 || !slots.includes('FP')) {
      throw new Error(`U11_FORMATIONS[${fid}] muss genau 8 eindeutige Slots inkl. FP haben.`);
    }
  }
}

const FALLBACK_LABELS: Record<FieldSlotId, string> = {
  GK: 'GK',
  LB: 'LV',
  RB: 'RV',
  CM: 'ZM',
  LW: 'LA',
  RW: 'RA',
  ST: 'ST',
  FP: 'FP',
};

export function isFairPlayFormationId(v: string | null | undefined): v is FairPlayFormationId {
  const s = String(v ?? '').trim();
  return s === '1-3-3-1' || s === '1-4-3' || s === '1-3-4';
}

export function isSevenFormationId(v: string | null | undefined): v is U11SevenFormationId {
  const s = String(v ?? '').trim();
  return s === '1-2-2-2' || s === '1-2-3-1' || s === '1-3-2-1' || s === '1-3-3';
}

export function isU11FormationId(v: string | null | undefined): v is U11FormationId {
  return isSevenFormationId(v) || isFairPlayFormationId(v);
}

/** Live-Pitch: bei FairPlay gespeicherte 8er-Formation oder Default 1-4-3. */
export function resolveLivePitchFormationId(
  baseFormationId: U11FormationId,
  fairPlayActive: boolean,
): U11FormationId {
  if (fairPlayActive) {
    return isFairPlayFormationId(baseFormationId) ? baseFormationId : DEFAULT_FAIRPLAY_FORMATION;
  }
  if (isFairPlayFormationId(baseFormationId)) return U11_FORMATION_DB_FALLBACK;
  return isSevenFormationId(baseFormationId) ? baseFormationId : U11_FORMATION_DB_FALLBACK;
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
