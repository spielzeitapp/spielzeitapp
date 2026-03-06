/**
 * Mapping Vereins-Schlüssel -> Logo-Pfad (public/logos, mit BASE_URL).
 * Fehlendes Logo → Placeholder mit Initialen verwenden.
 */
import { getLogoUrl } from '../utils/logoResolver';

export const CLUB_LOGOS: Record<string, string> = {
  spg_rohrbach: getLogoUrl('spg-rohrbach'),
  pottenbrunn: getLogoUrl('pottenbrunn'),
  alpenvorland_usg: getLogoUrl('alpenvorland-usg'),
  skn_stpoelten_a: getLogoUrl('skn-stpoelten-a'),
  spg_weinburg_a: getLogoUrl('spg-weinburg-a'),
};

/** Unser Verein (SPG Rohrbach) – Logo-Key für Heim-/Auswärtsanzeige */
export const OUR_CLUB_LOGO_KEY = 'spg_rohrbach';

/**
 * Normalisiert Anzeigenamen zu Logo-Key (lowercase, Leerzeichen → _, Sonderzeichen ersetzt).
 */
export function nameToLogoKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[äöüß]/g, (c) => ({ ä: 'a', ö: 'o', ü: 'u', ß: 'ss' }[c] ?? c))
    .replace(/\./g, '')
    .replace(/[^a-z0-9_]/g, '');
}

/** Bekannte Anzeigenamen → Logo-Key (für Abweichungen wie "SKN St. Pölten A" → skn_stpoelten_a). */
const NAME_TO_KEY: Record<string, string> = {
  'skn_st_poelten_a': 'skn_stpoelten_a',
  'alpenvorland_usg': 'alpenvorland_usg',
  'usg_alpenvorland_u12': 'alpenvorland_usg',
};

/**
 * Liefert den Logo-Pfad für einen Vereinsnamen oder -Key, oder null wenn kein Logo existiert.
 */
export function getClubLogoPath(teamNameOrKey: string): string | null {
  const normalized = CLUB_LOGOS[teamNameOrKey] ? teamNameOrKey : nameToLogoKey(teamNameOrKey);
  const key = NAME_TO_KEY[normalized] ?? normalized;
  return CLUB_LOGOS[key] ?? null;
}

/**
 * Initialen aus Vereinsnamen (z. B. "SPG Rohrbach" → "SR", "Alpenvorland USG" → "AU").
 */
export function getClubInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
