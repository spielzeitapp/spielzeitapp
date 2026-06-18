/**
 * Team-/Gegner-Logos: public/static unter logos/ (oder Storage-URLs).
 * Keine API-Pfade, nur public/logos bzw. Storage-URLs.
 */

import { getLogoUrl } from '../utils/logoResolver';

const OUR_TEAM_DISPLAY_NAME = 'SPG Rohrbach';
const OUR_TEAM_SLUG = 'spg-rohrbach';
export const PLACEHOLDER_LOGO = '/logos/placeholder-shield-a.png';

/** Normalisiert Anzeigenamen für Lookup (lowercase, Umlaute, Sonderzeichen raus). */
function normalizeForLookup(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9 ]/g, '');
}

/** Altersgruppe (z. B. U12) für Logo-Lookup abtrennen. */
function logoLookupKey(name: string): string {
  return normalizeForLookup(name)
    .replace(/\s+u\s*\d{1,2}\s*$/g, '')
    .trim();
}

function isOurNsgOrSpgTeam(key: string): boolean {
  return (
    key.includes('spg rohrbach') ||
    key.includes('nsg rohrbach') ||
    key.includes('nsg hainfeld')
  );
}

/** Bekannte Namen → Dateiname (ohne .png), falls Dateiname vom Slug abweicht. */
const LOGO_MAP: Record<string, string> = {
  'spg rohrbach': OUR_TEAM_SLUG,
  'nsg rohrbach': OUR_TEAM_SLUG,
  'nsg hainfeld': OUR_TEAM_SLUG,
  'skn st poelten': 'skn_stpoelten_a',
  'skn st.poelten': 'skn_stpoelten_a',
  'skn st. poelten': 'skn_stpoelten_a',
  'alpenvorland usg': 'alpenvorland_usg',
  'fk austria wien': 'fk-austria-wien',
  'sv ried': 'sv-ried',
  'first vienna': 'first-vienna',
  'first vienna fc': 'first-vienna',
  'ask wilhelmsburg': 'ask-wilhelmsburg',
  'tsv hartberg': 'tsv-hartberg',
  'sv mattersburg': 'sv-mattersburg',
  'fortuna wr neustadt': 'fortuna-wr-neustadt',
  'sc wr neustadt': 'fortuna-wr-neustadt',
};

function resolveMappedLogoFile(name: string): string | null {
  const rawKey = normalizeForLookup(name);
  const key = logoLookupKey(name);
  if (isOurNsgOrSpgTeam(rawKey) || isOurNsgOrSpgTeam(key)) {
    return OUR_TEAM_SLUG;
  }
  if (LOGO_MAP[key]) return LOGO_MAP[key];
  if (LOGO_MAP[rawKey]) return LOGO_MAP[rawKey];
  for (const [mapKey, file] of Object.entries(LOGO_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return file;
  }
  return null;
}

export type GetClubLogoOptions = {
  /** DB-Feld opponent_slug – wird bevorzugt. */
  slug?: string | null;
  /** DB-Feld opponent_logo_url – nur wenn public/Storage-URL. */
  logoUrl?: string | null;
};

export function isPlaceholderLogoUrl(url: string): boolean {
  return url.includes('placeholder-shield');
}

/** True wenn logo_url gesetzt oder bekannter Alias — sonst Initialen statt Placeholder. */
export function hasKnownClubLogo(nameOrSlug: string, options?: GetClubLogoOptions): boolean {
  if (options?.logoUrl && isAllowedLogoUrl(options.logoUrl)) return true;
  const name = String(nameOrSlug || '').trim();
  if (!name) return false;
  return resolveMappedLogoFile(name) != null;
}

/**
 * Normalisiert Namen zu URL-Slug: lowercase, Leerzeichen/Sonderzeichen → -
 * z.B. "SKN St. Pölten" → "skn-st-poelten"
 */
export function nameToSlug(name: string): string {
  if (!name || !String(name).trim()) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Erlaubte Logo-URL-Präfixe (kein API, nur public/Storage). */
const ALLOWED_LOGO_PREFIXES = ['/logos/', 'https://'];

function isAllowedLogoUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  const u = url.trim();
  return ALLOWED_LOGO_PREFIXES.some((p) => u.startsWith(p));
}

/**
 * Liefert die Logo-URL für einen Verein (Name oder Slug).
 * Nur public/static (/logos/<slug>.png) oder erlaubte Storage-URLs.
 * Fallback: /logos/placeholder-shield-a.png
 */
export function getClubLogo(nameOrSlug: string, options?: GetClubLogoOptions): string {
  const name = String(nameOrSlug || '').trim();

  if (options?.logoUrl && isAllowedLogoUrl(options.logoUrl)) {
    return options.logoUrl.trim();
  }
  if (options?.slug && options.slug.trim()) {
    const slug = options.slug.trim().replace(/\.png$/i, '');
    return getLogoUrl(slug);
  }

  if (!name) return PLACEHOLDER_LOGO;

  const mapped = resolveMappedLogoFile(name);
  if (mapped) {
    return getLogoUrl(`${mapped}.png`);
  }

  const slug = nameToSlug(name);
  if (slug) {
    return getLogoUrl(`${slug}.png`);
  }

  return PLACEHOLDER_LOGO;
}

/** @deprecated Nutze getClubLogo. Liefert Logo-URL (immer mit Fallback). */
export function getTeamLogo(teamName: string): string {
  return getClubLogo(teamName);
}

export function getOurTeamDisplayName(): string {
  return OUR_TEAM_DISPLAY_NAME;
}

/** Initialen für Platzhalter (falls Bild fehlt). */
export function getTeamInitials(name: string): string {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (parts[0] ?? name).slice(0, 2).toUpperCase();
}
