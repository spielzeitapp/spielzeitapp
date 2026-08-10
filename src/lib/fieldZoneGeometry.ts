/**
 * PLATZ.4: Normalisierte Spielfeld-Geometrie (Unit-Square [0,1]×[0,1]).
 * x von links, y von oben. Angrenzende Rechtecke kollidieren nicht.
 */

export type FieldLayoutKind = 'named' | 'entire' | 'half' | 'third' | 'quarter' | 'custom';

export type FieldSplitDemand = 'entire' | 'half' | 'third' | 'quarter';

export type NormalizedRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ZoneGeometry = {
  id?: string;
  zoneCode?: string | null;
  name: string;
  layoutKind: FieldLayoutKind;
  blocksEntireField: boolean;
  rect: NormalizedRect | null;
};

/** Standard-Presets (gleiche Wahrheit wie DB ensure_standard_field_zones). */
export const STANDARD_ZONE_PRESETS: ReadonlyArray<{
  zoneCode: string;
  name: string;
  layoutKind: Exclude<FieldLayoutKind, 'named' | 'custom'>;
  blocksEntireField: boolean;
  sortOrder: number;
  rect: NormalizedRect;
}> = [
  { zoneCode: 'entire', name: 'Ganzer Platz', layoutKind: 'entire', blocksEntireField: true, sortOrder: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
  { zoneCode: 'half_a', name: 'Hälfte A', layoutKind: 'half', blocksEntireField: false, sortOrder: 10, rect: { x: 0, y: 0, w: 0.5, h: 1 } },
  { zoneCode: 'half_b', name: 'Hälfte B', layoutKind: 'half', blocksEntireField: false, sortOrder: 11, rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  { zoneCode: 'third_a', name: 'Drittel A', layoutKind: 'third', blocksEntireField: false, sortOrder: 20, rect: { x: 0, y: 0, w: 1 / 3, h: 1 } },
  { zoneCode: 'third_b', name: 'Drittel B', layoutKind: 'third', blocksEntireField: false, sortOrder: 21, rect: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 } },
  { zoneCode: 'third_c', name: 'Drittel C', layoutKind: 'third', blocksEntireField: false, sortOrder: 22, rect: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 } },
  { zoneCode: 'quarter_a', name: 'Viertel A', layoutKind: 'quarter', blocksEntireField: false, sortOrder: 30, rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
  { zoneCode: 'quarter_b', name: 'Viertel B', layoutKind: 'quarter', blocksEntireField: false, sortOrder: 31, rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
  { zoneCode: 'quarter_c', name: 'Viertel C', layoutKind: 'quarter', blocksEntireField: false, sortOrder: 32, rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
  { zoneCode: 'quarter_d', name: 'Viertel D', layoutKind: 'quarter', blocksEntireField: false, sortOrder: 33, rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
];

export const SPLIT_DEMAND_LABELS: Record<FieldSplitDemand, string> = {
  entire: 'Ganzer Platz',
  half: '½ Platz',
  third: '⅓ Platz',
  quarter: '¼ Platz',
};

export const SPLIT_DEMAND_SHORT: Record<FieldSplitDemand, string> = {
  entire: 'Ganz',
  half: '½',
  third: '⅓',
  quarter: '¼',
};

export function rectsOverlap(a: NormalizedRect, b: NormalizedRect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function entireFieldRect(): NormalizedRect {
  return { x: 0, y: 0, w: 1, h: 1 };
}

export function resolveZoneRect(zone: ZoneGeometry | null | undefined): NormalizedRect | null {
  if (!zone) return entireFieldRect();
  if (zone.blocksEntireField || zone.layoutKind === 'entire') return entireFieldRect();
  if (zone.rect && zone.rect.w > 0 && zone.rect.h > 0) return zone.rect;
  return null;
}

/**
 * Räumlicher Konflikt zweier Zonen.
 * Ohne Geometrie: Legacy (gleiche ID oder blocks_entire).
 */
export function zonesSpatiallyConflict(
  a: ZoneGeometry | null | undefined,
  b: ZoneGeometry | null | undefined,
): boolean {
  const aBlocks = !a || a.blocksEntireField || a.layoutKind === 'entire';
  const bBlocks = !b || b.blocksEntireField || b.layoutKind === 'entire';
  if (aBlocks || bBlocks) return true;

  const aRect = resolveZoneRect(a);
  const bRect = resolveZoneRect(b);
  if (aRect && bRect) return rectsOverlap(aRect, bRect);

  // Legacy ohne Geometrie
  if (a?.id && b?.id) return a.id === b.id;
  return true;
}

export function filterZonesForDemand(
  zones: readonly ZoneGeometry[],
  demand: FieldSplitDemand,
): ZoneGeometry[] {
  return zones.filter((z) => {
    if (demand === 'entire') return z.layoutKind === 'entire' || z.blocksEntireField;
    return z.layoutKind === demand && !z.blocksEntireField;
  });
}

export function inferDemandFromZone(zone: ZoneGeometry | null | undefined): FieldSplitDemand {
  if (!zone || zone.blocksEntireField || zone.layoutKind === 'entire') return 'entire';
  if (zone.layoutKind === 'half' || zone.layoutKind === 'third' || zone.layoutKind === 'quarter') {
    return zone.layoutKind;
  }
  return 'entire';
}

export function occupancyFraction(zone: ZoneGeometry | null | undefined): number {
  if (!zone || zone.blocksEntireField || zone.layoutKind === 'entire') return 1;
  const rect = resolveZoneRect(zone);
  if (!rect) return 0;
  return Math.min(1, Math.max(0, rect.w * rect.h));
}

export function layoutKindFromCode(code: string | null | undefined): FieldLayoutKind {
  const c = String(code ?? '').trim().toLowerCase();
  if (c === 'entire') return 'entire';
  if (c.startsWith('half')) return 'half';
  if (c.startsWith('third')) return 'third';
  if (c.startsWith('quarter')) return 'quarter';
  return 'named';
}

export function parseRect(
  x: number | string | null | undefined,
  y: number | string | null | undefined,
  w: number | string | null | undefined,
  h: number | string | null | undefined,
): NormalizedRect | null {
  const nx = Number(x);
  const ny = Number(y);
  const nw = Number(w);
  const nh = Number(h);
  if (![nx, ny, nw, nh].every((n) => Number.isFinite(n))) return null;
  if (nw <= 0 || nh <= 0) return null;
  return { x: nx, y: ny, w: nw, h: nh };
}
