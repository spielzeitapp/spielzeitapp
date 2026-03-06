import { TEAM_LOGO_ALIASES } from '../data/teamLogoAliases';

export const LOGO_BASE =
  'https://myquetschnapp.at/spielzeitapp_api/logos';
export const PLACEHOLDER = `${LOGO_BASE}/placeholder.png`;

/**
 * Normalisiert Teamnamen für Lookup: lowercase, trim, "St."→"st", Punkte weg,
 * Umlaute → oe/ae/ue, mehrfache Leerzeichen → eines.
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\bst\.\b/gi, 'st')
    .replace(/\./g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Erzeugt einen dateinamen-tauglichen Slug: nur a-z, 0-9, Unterstrich (lowercase).
 */
export function slugify(name: string): string {
  const n = normalizeName(name);
  return n
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';
}

/**
 * Liefert die volle Logo-URL für einen Teamnamen (Server-Basis + Dateiname).
 * Unbekannte Teams: Fallback auf slugify(key).png; onError in UI auf PLACEHOLDER setzen.
 */
export function getLogoUrl(teamName: string): string {
  const key = normalizeName(teamName);
  const file = TEAM_LOGO_ALIASES[key] ?? `${slugify(key)}.png`;
  return `${LOGO_BASE}/${file}`;
}
