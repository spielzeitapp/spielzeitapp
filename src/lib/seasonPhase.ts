/**
 * Saisonphase (Herbst / Frühjahr) für PDF-Header & Dateinamen.
 * Persistenz: team_seasons.season_phase ('autumn' | 'spring' | 'full' | null).
 * Kein Monatsraten — nur gesetzte Phase verwenden.
 */

export type SeasonPhase = 'autumn' | 'spring' | 'full';

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
 * PDF-Haupttitel-Suffix inkl. führendem Leerzeichen, z. B. „ HERBST 2026“.
 * Ohne Phase / bei full → leer (kein erfundenes Halbjahr).
 */
export function seasonPhaseHeaderSuffix(
  phase: SeasonPhase | null | undefined,
  seasonName: string | null | undefined,
): string {
  const p = phase ?? null;
  if (!p || p === 'full') return '';
  const years = parseSeasonYears(seasonName);
  if (p === 'autumn') {
    return years?.start ? ` HERBST ${years.start}` : ' HERBST';
  }
  if (p === 'spring') {
    return years?.end ? ` FRÜHJAHR ${years.end}` : ' FRÜHJAHR';
  }
  return '';
}

/** Dateiname-Slug: herbst | fruehjahr | '' */
export function seasonPhaseFilenameSlug(phase: SeasonPhase | null | undefined): string {
  const p = phase ?? null;
  if (p === 'autumn') return 'herbst';
  if (p === 'spring') return 'fruehjahr';
  return '';
}

export function seasonPhaseLabelDe(phase: SeasonPhase | null | undefined): string | null {
  const p = phase ?? null;
  if (p === 'autumn') return 'Herbst';
  if (p === 'spring') return 'Frühjahr';
  if (p === 'full') return 'Gesamt';
  return null;
}
