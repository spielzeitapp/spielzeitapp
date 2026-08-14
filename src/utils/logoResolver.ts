/**
 * Logo-Auflösung für Spielplan – nur public/logos/, keine DB, kein Backend.
 * Zugriff: ${BASE}logos/<file>.png (BASE = import.meta.env.BASE_URL)
 */

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '') + '/';
const SHIELD_PLACEHOLDER = `${BASE}logos/placeholder-shield-a.png`;
const LOGO_EXT_RE = /\.(png|jpg|jpeg|svg)(\?.*)?$/i;

export function isValidLogoUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  const value = url.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return LOGO_EXT_RE.test(lower);
  }
  return lower.includes('/logos/') && LOGO_EXT_RE.test(lower);
}

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

  if (isValidLogoUrl(value) && value.startsWith('http')) return value;
  if (isValidLogoUrl(value) && value.includes('/logos/')) return value;
  if (!value) return SHIELD_PLACEHOLDER;

  const file = /\.(png|jpe?g|svg)$/i.test(value) ? value : `${value}.png`;
  return `${BASE}logos/${file}`.replace(/\/{2,}/g, '/');
}

export const PLACEHOLDER_LOGO = SHIELD_PLACEHOLDER;

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
  if (n.includes('spg') && n.includes('rohrbach')) return getLogoUrl('nsg-goelsental');
  if (n.includes('skn')) return getLogoUrl('skn-stpoelten-a');
  if (n.includes('alpenvorland')) return getLogoUrl('usg-alpenvorland');
  if (n.includes('wilhelmsburg')) return getLogoUrl('ask-wilhelmsburg');
  if (n.includes('weinburg')) {
    if (n.includes('weinburg-a') || n.endsWith('weinburg-a') || n.includes('weinburg a')) {
      return getLogoUrl('spg-weinburg-a');
    }
    return getLogoUrl('spg-weinburg');
  }
  // Bischofstetten
  if (n.includes('bischofstetten')) return getLogoUrl('bischofstetten');
  if (n.includes('loosdorf')) return getLogoUrl('loosdorf');
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
  if (isValidLogoUrl(optionalLogoUrl)) {
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
  if (isValidLogoUrl(value) && value.startsWith('http')) return value;
  if (isValidLogoUrl(value) && value.includes('/logos/')) return value;

  const file = toLogoFile(value);
  if (!file) return PLACEHOLDER_LOGO;
  return getLogoUrl(file);
}
