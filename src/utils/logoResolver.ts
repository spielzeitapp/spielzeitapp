/**
 * Logo-Auflösung für Spielplan – nur public/logos/, keine DB, kein Backend.
 * Zugriff: ${BASE}logos/<file>.png (BASE = import.meta.env.BASE_URL)
 */

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '') + '/';

/**
 * Erzeugt aus Anzeige-Namen einen kebab-case Logo-Dateinamen (ohne .png).
 * Nur für Pfad-Berechnung – Anzeige-Text bleibt unverändert.
 * - lowercase, Umlaute: ä→ae, ö→oe, ü→ue, ß→ss
 * - Punkte entfernen (z. B. "St.Pölten" → "stpoelten")
 * - Leerzeichen, Slash, Sonderzeichen → "-", mehrfach "-" zusammenfassen
 */
export function toLogoFile(nameOrSlug: string): string {
  return (nameOrSlug ?? '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getLogoUrl(slugOrFilename?: string | null): string {
  const value = (slugOrFilename ?? '').trim();

  if (value && value.startsWith('http')) return value;
  if (!value) return `${BASE}logos/placeholder.png`;

  const file = value.toLowerCase().endsWith('.png') ? value : `${value}.png`;
  return `${BASE}logos/${file}`.replace(/\/{2,}/g, '/');
}

export const PLACEHOLDER_LOGO = `${BASE}logos/placeholder.png`;

/** Intern für getTeamLogoSrc – gleiche Zeichenregeln wie toLogoFile. */
function normalize(teamName: string): string {
  if (!teamName || typeof teamName !== 'string') return '';
  return teamName
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Liefert den Pfad zum Team-Logo (public: logos/<file>.png mit BASE_URL).
 * - "SPG Rohrbach" -> spg-rohrbach
 * - enthält "skn" -> skn-stpoelten-a
 * - enthält "alpenvorland" -> alpenvorland-usg
 * - sonst -> placeholder
 */
export function getTeamLogoSrc(teamName: string): string {
  const n = normalize(teamName);
  if (!n) return PLACEHOLDER_LOGO;
  if (n.includes('spg') && n.includes('rohrbach')) return getLogoUrl('spg-rohrbach');
  if (n.includes('skn')) return getLogoUrl('skn-stpoelten-a');
  if (n.includes('alpenvorland')) return getLogoUrl('alpenvorland-usg');
  return PLACEHOLDER_LOGO;
}

/**
 * Robuste Logo-URL für MatchCard: optionalLogoUrl (https) > slug > Name-Lookup.
 * onError im <img> weiterhin auf /logos/placeholder.png setzen.
 */
export function getClubLogo(
  slugOrName: string,
  optionalLogoUrl?: string | null
): string {
  if (optionalLogoUrl && typeof optionalLogoUrl === 'string' && optionalLogoUrl.trim().startsWith('http')) {
    return optionalLogoUrl.trim();
  }
  return getClubLogoUrl(slugOrName);
}

/** Alias: gleiche Logik wie toLogoFile (kebab-case für Logo-Dateinamen). */
export function normalizeLogoKey(input: string): string {
  return toLogoFile(input);
}

/** Alias für ältere Aufrufer. */
export function slugifyClubName(name: string): string {
  return toLogoFile(name);
}

/**
 * Club-Logo-URL: ${BASE}logos/<toLogoFile(input)>.png oder Placeholder.
 * HTTP-URLs werden unverändert durchgereicht.
 */
export function getClubLogoUrl(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value) return PLACEHOLDER_LOGO;
  if (value.startsWith('http')) return value;

  const file = toLogoFile(value);
  if (!file) return PLACEHOLDER_LOGO;
  return getLogoUrl(file);
}
