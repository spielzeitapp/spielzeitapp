/**
 * Team-/Gegner-Logos: public/static unter logos/ (oder Storage-URLs).
 * Keine API-Pfade, nur public/logos bzw. Storage-URLs.
 */

import { getLogoUrl } from '../utils/logoResolver';
import { safeText } from './safeText';

const OUR_TEAM_DISPLAY_NAME = 'SPG Rohrbach';
const SPG_ROHRBACH_SLUG = 'spg-rohrbach';
const NSG_GOELSENTAL_SLUG = 'nsg-goelsental';
/** Staging/Live Team-ID SPG Rohrbach (saisonübergreifend gleiche team_id). */
export const SPG_ROHRBACH_TEAM_ID = '1ebe3d18-78ff-4986-a0b2-31cc1b7af938';
export const PLACEHOLDER_LOGO = '/logos/placeholder-shield-a.png';

export type GetClubLogoOptions = {
  /** DB-Feld opponent_slug – wird bevorzugt. */
  slug?: string | null;
  /** DB-Feld opponent_logo_url – nur wenn public/Storage-URL. */
  logoUrl?: string | null;
  /** Unser Heim-/Auswärtsteam (nicht Gegner) → immer SPG-Rohrbach-Asset. */
  ourTeam?: boolean;
  /** Stabile teams.id — saisonübergreifend. */
  teamId?: string | null;
};

/**
 * Match-/Spielbericht-Teamname (ohne Altersklasse, ohne Saison).
 * TeamSeason-Labels (Switcher/Verwaltung) nutzen weiterhin resolveTeamSeasonLabelParts.
 */
export function getOurTeamDisplayName(): string {
  return OUR_TEAM_DISPLAY_NAME;
}

/** Stabiles Vereinslogo — unabhängig von U11/U12 oder Saison-Label. */
export function getOurTeamLogoUrl(): string {
  return getLogoUrl(`${SPG_ROHRBACH_SLUG}.png`);
}

/** Normalisiert Anzeigenamen für Lookup (lowercase, Umlaute, Sonderzeichen raus). */
function normalizeForLookup(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Club-Key für Logo-Lookup: Altersklasse + Saisonjahr abtrennen.
 * „U11 SPG Rohrbach · 2025/26“ → „spg rohrbach“
 */
function logoLookupKey(name: string): string {
  return normalizeForLookup(name)
    .replace(/^\s*u\s*\d{1,2}\s+/g, '')
    .replace(/\s+u\s*\d{1,2}\s*$/g, '')
    .replace(/\s+\d{4}\s*\d{2,4}\s*$/g, '')
    .trim();
}

function isOurTeamIdentity(nameOrSlug: string, options?: GetClubLogoOptions): boolean {
  if (options?.ourTeam) return true;
  const tid = String(options?.teamId ?? '').trim();
  if (tid && tid === SPG_ROHRBACH_TEAM_ID) return true;
  const key = logoLookupKey(nameOrSlug);
  return key === 'spg rohrbach';
}

function isNsgHeimteamKey(key: string): boolean {
  return key.includes('nsg rohrbach') || key.includes('nsg hainfeld');
}

/**
 * Bekannte Anzeigenamen → Dateiname unter public/logos (ohne .png).
 * Nur lokale Assets — keine externen URLs.
 */
const LOGO_MAP: Record<string, string> = {
  // NSG Heimteams (gemeinsames Vereinslogo)
  'nsg rohrbach': NSG_GOELSENTAL_SLUG,
  'nsg hainfeld': NSG_GOELSENTAL_SLUG,
  'nsg goelsental': NSG_GOELSENTAL_SLUG,
  // SPG (eigenes Logo, unverändert)
  'spg rohrbach': SPG_ROHRBACH_SLUG,
  // FK Austria Wien
  'fk austria wien': 'fk-austria-wien',
  'austria wien': 'fk-austria-wien',
  austria: 'fk-austria-wien',
  // SV Ried
  'sv ried': 'sv-ried',
  ried: 'sv-ried',
  // First Vienna
  'first vienna': 'first-vienna',
  'first vienna fc': 'first-vienna',
  vienna: 'first-vienna',
  // ASK Wilhelmsburg
  'ask wilhelmsburg': 'ask-wilhelmsburg',
  wilhelmsburg: 'ask-wilhelmsburg',
  // TSV Hartberg
  'tsv hartberg': 'tsv-hartberg',
  hartberg: 'tsv-hartberg',
  // SV Mattersburg
  'sv mattersburg': 'sv-mattersburg',
  mattersburg: 'sv-mattersburg',
  // Fortuna Wr. Neustadt
  'fortuna wr neustadt': 'fortuna-wr-neustadt',
  'fortuna wiener neustadt': 'fortuna-wr-neustadt',
  'wr neustadt': 'fortuna-wr-neustadt',
  'sc wr neustadt': 'fortuna-wr-neustadt',
  // Bestehende Gegner
  'skn st poelten': 'skn_stpoelten_a',
  'skn st.poelten': 'skn_stpoelten_a',
  'skn st. poelten': 'skn_stpoelten_a',
  'alpenvorland usg': 'alpenvorland_usg',
};

/** Längere Aliase zuerst — verhindert zu frühe Kurz-Treffer bei Teilstrings. */
const LOGO_MAP_KEYS_BY_LENGTH = Object.keys(LOGO_MAP).sort((a, b) => b.length - a.length);

function resolveMappedLogoFile(name: string): string | null {
  const rawKey = normalizeForLookup(name);
  const key = logoLookupKey(name);
  if (!key && !rawKey) return null;

  if (isNsgHeimteamKey(key) || isNsgHeimteamKey(rawKey)) {
    return NSG_GOELSENTAL_SLUG;
  }

  if (LOGO_MAP[key]) return LOGO_MAP[key];
  if (LOGO_MAP[rawKey]) return LOGO_MAP[rawKey];

  for (const mapKey of LOGO_MAP_KEYS_BY_LENGTH) {
    if (mapKey.length < 4) continue;
    if (key === mapKey || rawKey === mapKey) return LOGO_MAP[mapKey];
    if (key.startsWith(`${mapKey} `) || key.endsWith(` ${mapKey}`)) {
      return LOGO_MAP[mapKey];
    }
  }

  return null;
}

export function isPlaceholderLogoUrl(url: string): boolean {
  return url.includes('placeholder-shield');
}

/** True wenn logo_url gesetzt oder bekannter Alias — sonst Initialen statt Placeholder. */
export function hasKnownClubLogo(nameOrSlug: string, options?: GetClubLogoOptions): boolean {
  if (options?.logoUrl && isAllowedLogoUrl(options.logoUrl)) return true;
  if (isOurTeamIdentity(nameOrSlug, options)) return true;
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

function isAllowedLogoUrl(url: unknown): boolean {
  const u = safeText(url);
  if (!u) return false;
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
    return safeText(options.logoUrl);
  }
  if (options?.slug && safeText(options.slug)) {
    const slug = safeText(options.slug).replace(/\.png$/i, '');
    return getLogoUrl(slug);
  }

  // Unser Verein: nie über Saison-/U-Label-String raten.
  if (isOurTeamIdentity(name, options)) {
    return getOurTeamLogoUrl();
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

/** Initialen für Platzhalter (falls Bild fehlt). */
export function getTeamInitials(name: string): string {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (parts[0] ?? name).slice(0, 2).toUpperCase();
}
