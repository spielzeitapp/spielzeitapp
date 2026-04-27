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
};

/**
 * Koordinaten in Prozent (0–100): x von links, y von oben.
 * Zuordnung zu FieldSlotId wie in den Kommentaren — nur Darstellung, keine DB-Änderung.
 */
/**
 * y von oben: Gegner-Tor oben, eigenes unten.
 * ST nah am gegnerischen Strafraum, MF klar unterhalb Mittellinie (50),
 * Abwehr oberhalb des eigenen Strafraums, TW tief Richtung Tor (nicht „am Strafraum kleben“).
 */
export const U11_FORMATIONS: Record<U11FormationId, FormationSlotLayout[]> = {
  '1-2-2-2': [
    { slot: 'GK', label: 'GK', x: 50, y: 90 },
    { slot: 'LB', label: 'LV', x: 30, y: 72 },
    { slot: 'RB', label: 'RV', x: 70, y: 72 },
    { slot: 'LW', label: 'LM', x: 32, y: 56 },
    { slot: 'RW', label: 'RM', x: 68, y: 56 },
    { slot: 'CM', label: 'LS', x: 35, y: 17 },
    { slot: 'ST', label: 'RS', x: 65, y: 17 },
  ],
  '1-2-3-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 90 },
    { slot: 'LB', label: 'LV', x: 28, y: 72 },
    { slot: 'RB', label: 'RV', x: 72, y: 72 },
    { slot: 'LW', label: 'LA', x: 22, y: 56 },
    { slot: 'CM', label: 'ZM', x: 50, y: 56 },
    { slot: 'RW', label: 'RA', x: 78, y: 56 },
    { slot: 'ST', label: 'ST', x: 50, y: 17 },
  ],
  '1-3-2-1': [
    { slot: 'GK', label: 'GK', x: 50, y: 90 },
    { slot: 'LB', label: 'LV', x: 24, y: 72 },
    { slot: 'CM', label: 'IV', x: 50, y: 72 },
    { slot: 'RB', label: 'RV', x: 76, y: 72 },
    { slot: 'LW', label: 'LZM', x: 35, y: 56 },
    { slot: 'RW', label: 'RZM', x: 65, y: 56 },
    { slot: 'ST', label: 'ST', x: 50, y: 17 },
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
