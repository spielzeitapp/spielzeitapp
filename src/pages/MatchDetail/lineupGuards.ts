import type { Match } from '../../types/match';
import type { FieldSlotId } from '../../types/match';

/** Alle Slot-IDs der Startelf (GK + Feld). */
export const STARTELF_SLOT_IDS: FieldSlotId[] = [
  'GK',
  'LB',
  'RB',
  'CM',
  'LW',
  'RW',
  'ST',
];

/** Mindestanzahl Feldspieler (ohne GK) zum Start. */
export const MIN_FIELD_PLAYERS = 3;

/**
 * Gibt alle playerIds zurück, die aktuell in Slots des angegebenen Teams stehen.
 */
export function getOnFieldPlayers(
  match: Match,
  teamSide: 'home' | 'away'
): string[] {
  const field = match.field?.[teamSide] ?? {};
  return (Object.values(field).filter(Boolean) as string[]).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
}

/**
 * Prüft, ob die Startelf für das Heim-Team vollständig genug ist, um live zu starten:
 * - GK muss belegt sein
 * - Mindestanzahl Feldspieler (MIN_FIELD_PLAYERS) muss erreicht sein
 */
export function isStartelfCompleteForLive(match: Match): boolean {
  const home = match.field?.home ?? {};
  const gkFilled = typeof home.GK === 'string' && home.GK.trim().length > 0;
  const fieldSlotIds = STARTELF_SLOT_IDS.filter((id) => id !== 'GK');
  const fieldFilled = fieldSlotIds.filter(
    (id) => typeof home[id] === 'string' && (home[id] as string).trim().length > 0
  ).length;
  return gkFilled && fieldFilled >= MIN_FIELD_PLAYERS;
}
