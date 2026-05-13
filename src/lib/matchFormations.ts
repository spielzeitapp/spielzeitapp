import type { FieldSlotId } from '../types/match';

/** Sichtbare 7er-Systeme (U11); Speicherung bleibt über FieldSlotId in match_lineup. */
export type U11FormationId = '1-2-2-2' | '1-2-3-1' | '1-3-2-1' | '1-3-3';

export const DEFAULT_U11_FORMATION: U11FormationId = '1-2-2-2';

/** Wenn `matches.u11_formation_id` NULL ist und kein gültiger lokaler Cache: einheitlicher Pitch-Fallback. */
export const U11_FORMATION_DB_FALLBACK: U11FormationId = '1-2-3-1';

export const U11_FORMATION_CHOICES: U11FormationId[] = ['1-2-2-2', '1-2-3-1', '1-3-2-1', '1-3-3'];

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
    { slot: 'GK', label: 'GK', x: 50, y: 90, labelDy: 7 },
    { slot: 'LB', label: 'LV', x: 30, y: 68, labelDx: -4, labelDy: 2 },
    { slot: 'RB', label: 'RV', x: 70, y: 68, labelDx: 4, labelDy: 2 },
    { slot: 'LW', label: 'LM', x: 24, y: 42, labelDx: -4, labelDy: 2 },
    { slot: 'RW', label: 'RM', x: 76, y: 42, labelDx: 4, labelDy: 2 },
    { slot: 'CM', label: 'LS', x: 32, y: 18, labelDx: -4, labelDy: 2 },
    { slot: 'ST', label: 'RS', x: 68, y: 18, labelDx: 4, labelDy: 2 },
  ],
  '1-2-3-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 90, labelDy: 7 },
    { slot: 'LB', label: 'LV', x: 28, y: 68, labelDx: -4, labelDy: 2 },
    { slot: 'RB', label: 'RV', x: 72, y: 68, labelDx: 4, labelDy: 2 },
    { slot: 'LW', label: 'LA', x: 20, y: 45, labelDx: -5, labelDy: 2 },
    { slot: 'CM', label: 'ZM', x: 50, y: 40, labelDy: 2 },
    { slot: 'RW', label: 'RA', x: 80, y: 45, labelDx: 5, labelDy: 2 },
    { slot: 'ST', label: 'ST', x: 50, y: 17, labelDy: 2 },
  ],
  '1-3-2-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 90, labelDy: 7 },
    { slot: 'LB', label: 'LV', x: 18, y: 65, labelDx: -5, labelDy: 2 },
    { slot: 'CM', label: 'IV', x: 50, y: 66, labelDy: 2 },
    { slot: 'RB', label: 'RV', x: 82, y: 65, labelDx: 5, labelDy: 2 },
    { slot: 'LW', label: 'LZM', x: 30, y: 42, labelDx: -4, labelDy: 2 },
    { slot: 'RW', label: 'RZM', x: 70, y: 42, labelDx: 4, labelDy: 2 },
    { slot: 'ST', label: 'ST', x: 50, y: 17, labelDy: 2 },
  ],
  /** 1 GK + 6 Feld — Reihenfolge: hinten nach vorne, ST zuletzt (höchste Paint-Order), damit der Mittelstürmer bei Überlappung mit LF/RF antippbar bleibt. */
  '1-3-3': [
    { slot: 'GK', label: 'GK', x: 50, y: 90, labelDy: 7 },
    { slot: 'LB', label: 'LV', x: 18, y: 66, labelDx: -5, labelDy: 2 },
    { slot: 'CM', label: 'IV', x: 50, y: 67, labelDy: 2 },
    { slot: 'RB', label: 'RV', x: 82, y: 66, labelDx: 5, labelDy: 2 },
    { slot: 'LW', label: 'LF', x: 22, y: 28, labelDx: -5, labelDy: 2 },
    { slot: 'RW', label: 'RF', x: 78, y: 28, labelDx: 5, labelDy: 2 },
    { slot: 'ST', label: 'ST', x: 50, y: 20, labelDy: 2 },
  ],
};

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  for (const fid of U11_FORMATION_CHOICES) {
    const rows = U11_FORMATIONS[fid];
    const slots = rows.map((r) => r.slot);
    if (rows.length !== 7 || new Set(slots).size !== 7) {
      throw new Error(`U11_FORMATIONS[${fid}] muss genau 7 eindeutige Slots (GK + 6 Feld) haben.`);
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
};

export function isU11FormationId(v: string | null | undefined): v is U11FormationId {
  const s = String(v ?? '').trim();
  return s === '1-2-2-2' || s === '1-2-3-1' || s === '1-3-2-1' || s === '1-3-3';
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
