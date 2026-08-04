/**
 * Saisonphase für UI, PDF-Header und Dateinamen.
 * Persistenz: team_seasons.season_phase ('autumn' | 'spring' | 'full' | null).
 * `null` bedeutet jetzt: automatisch erkennen.
 */

import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';

export type SeasonPhase = 'autumn' | 'spring' | 'full';
export type SeasonPhaseSource = 'manual' | 'auto';
export type SeasonPhaseSlug = 'herbst' | 'fruehjahr' | null;

export type ResolvedSeasonPhase = {
  phase: SeasonPhase | null;
  source: SeasonPhaseSource;
  label: string | null;
  slug: SeasonPhaseSlug;
};

export function normalizeSeasonPhase(raw: string | null | undefined): SeasonPhase | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s) return null;
  if (s === 'autumn' || s === 'herbst' || s === 'fall') return 'autumn';
  if (s === 'spring' || s === 'fruhjahr' || s === 'fruehjahr') return 'spring';
  if (s === 'full' || s === 'gesamt' || s === 'whole') return 'full';
  return null;
}

/** Aus „2026/27“ oder „2026/2027“ → Start-/Endjahr. */
export function parseSeasonYears(
  seasonName: string | null | undefined,
): { start: number; end: number } | null {
  const raw = String(seasonName ?? '').trim();
  const m = raw.match(/(\d{4})\s*[/\-–]\s*(\d{2,4})/);
  if (!m) return null;
  const start = Number.parseInt(m[1], 10);
  let end = Number.parseInt(m[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < 100) {
    end = Math.floor(start / 100) * 100 + end;
    if (end < start) end += 100;
  }
  return { start, end };
}

/**
 * Zentraler Resolver:
 * - manuelle Werte haben Vorrang
 * - `null` = automatische Erkennung anhand Saisonjahr + Vienna-Datum
 * - außerhalb der Saison wird nichts geraten
 */
export function resolveSeasonPhase(opts: {
  seasonName: string | null | undefined;
  storedPhase: SeasonPhase | string | null | undefined;
  now?: Date;
}): ResolvedSeasonPhase {
  const phase = normalizeSeasonPhase(opts.storedPhase);
  const years = parseSeasonYears(opts.seasonName);

  if (phase === 'full') {
    return { phase: 'full', source: 'manual', label: null, slug: null };
  }
  if (phase === 'autumn') {
    return {
      phase: 'autumn',
      source: 'manual',
      label: years?.start ? `Herbst ${years.start}` : 'Herbst',
      slug: 'herbst',
    };
  }
  if (phase === 'spring') {
    return {
      phase: 'spring',
      source: 'manual',
      label: years?.end ? `Frühjahr ${years.end}` : 'Frühjahr',
      slug: 'fruehjahr',
    };
  }

  if (!years) {
    return { phase: null, source: 'auto', label: null, slug: null };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const parts = getDateTimePartsInTimeZone(now, VIENNA_TZ);
  if (!parts) {
    return { phase: null, source: 'auto', label: null, slug: null };
  }

  if (parts.year === years.start && parts.month >= 8 && parts.month <= 12) {
    return {
      phase: 'autumn',
      source: 'auto',
      label: `Herbst ${years.start}`,
      slug: 'herbst',
    };
  }

  if (parts.year === years.end && parts.month >= 1 && parts.month <= 7) {
    return {
      phase: 'spring',
      source: 'auto',
      label: `Frühjahr ${years.end}`,
      slug: 'fruehjahr',
    };
  }

  return { phase: null, source: 'auto', label: null, slug: null };
}

/**
 * PDF-Haupttitel-Suffix inkl. führendem Leerzeichen, z. B. „ HERBST 2026“.
 * Ohne Phase / bei full / außerhalb der Saison → leer.
 */
export function seasonPhaseHeaderSuffix(opts: {
  seasonName: string | null | undefined;
  storedPhase: SeasonPhase | string | null | undefined;
  now?: Date;
}): string {
  const resolved = resolveSeasonPhase(opts);
  return resolved.label ? ` ${resolved.label.toUpperCase()}` : '';
}

/** Dateiname-Slug: herbst | fruehjahr | '' */
export function seasonPhaseFilenameSlug(opts: {
  seasonName: string | null | undefined;
  storedPhase: SeasonPhase | string | null | undefined;
  now?: Date;
}): string {
  return resolveSeasonPhase(opts).slug ?? '';
}

export function seasonPhaseLabelDe(phase: SeasonPhase | null | undefined): string | null {
  const p = phase ?? null;
  if (p === 'autumn') return 'Herbst';
  if (p === 'spring') return 'Frühjahr';
  if (p === 'full') return 'Ganze Saison';
  return null;
}
