/**
 * Plätze und Teilflächen einer Sportanlage (venues).
 */

import { supabase } from './supabaseClient';
import {
  layoutKindFromCode,
  parseRect,
  type FieldLayoutKind,
  type FieldSplitDemand,
  type NormalizedRect,
  type ZoneGeometry,
} from './fieldZoneGeometry';

export type VenueFieldType = 'main' | 'training' | 'artificial' | 'small' | 'hall' | 'other';

export const VENUE_FIELD_TYPE_LABELS: Record<VenueFieldType, string> = {
  main: 'Hauptfeld',
  training: 'Trainingsplatz',
  artificial: 'Kunstrasen',
  small: 'Kleinfeld',
  hall: 'Halle',
  other: 'Sonstiger Platz',
};

export type VenueFieldRow = {
  id: string;
  venue_id: string;
  club_id: string;
  name: string;
  field_type: VenueFieldType;
  color_hex: string | null;
  sort_order: number;
  is_active: boolean;
  supported_splits?: FieldSplitDemand[];
};

export type VenueFieldZoneRow = {
  id: string;
  field_id: string;
  club_id: string;
  name: string;
  blocks_entire_field: boolean;
  sort_order: number;
  is_active: boolean;
  zone_code?: string | null;
  layout_kind?: FieldLayoutKind;
  rect_x?: number | null;
  rect_y?: number | null;
  rect_w?: number | null;
  rect_h?: number | null;
};

const FIELD_SELECT =
  'id, venue_id, club_id, name, field_type, color_hex, sort_order, is_active, supported_splits';
const ZONE_SELECT =
  'id, field_id, club_id, name, blocks_entire_field, sort_order, is_active, zone_code, layout_kind, rect_x, rect_y, rect_w, rect_h';

const FIELD_SELECT_LEGACY =
  'id, venue_id, club_id, name, field_type, color_hex, sort_order, is_active';
const ZONE_SELECT_LEGACY =
  'id, field_id, club_id, name, blocks_entire_field, sort_order, is_active';

export function zoneRowToGeometry(z: VenueFieldZoneRow): ZoneGeometry {
  const rect: NormalizedRect | null = parseRect(z.rect_x, z.rect_y, z.rect_w, z.rect_h);
  const layoutKind: FieldLayoutKind =
    z.layout_kind && z.layout_kind !== 'named'
      ? z.layout_kind
      : z.blocks_entire_field
        ? 'entire'
        : layoutKindFromCode(z.zone_code);
  return {
    id: z.id,
    zoneCode: z.zone_code ?? null,
    name: z.name,
    layoutKind,
    blocksEntireField: z.blocks_entire_field || layoutKind === 'entire',
    rect,
  };
}
function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function isFieldsMigrationPending(message: string): boolean {
  return /venue_fields|venue_field_zones|does not exist|schema cache|42P01/i.test(message);
}

function isPlatz4ColumnMissing(message: string): boolean {
  return /supported_splits|zone_code|layout_kind|rect_x|column .* does not exist/i.test(message);
}

function normalizeFieldType(raw: string | null | undefined): VenueFieldType {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'main' || t === 'training' || t === 'artificial' || t === 'small' || t === 'hall') {
    return t;
  }
  return 'other';
}

function normalizeSplits(raw: unknown): FieldSplitDemand[] {
  const allowed = new Set<FieldSplitDemand>(['entire', 'half', 'third', 'quarter']);
  if (!Array.isArray(raw)) return ['entire', 'half', 'third', 'quarter'];
  const out = raw
    .map((x) => String(x).trim().toLowerCase())
    .filter((x): x is FieldSplitDemand => allowed.has(x as FieldSplitDemand));
  return out.length ? out : ['entire', 'half', 'third', 'quarter'];
}

function mapFieldRow(r: VenueFieldRow): VenueFieldRow {
  return {
    ...r,
    field_type: normalizeFieldType(r.field_type),
    supported_splits: normalizeSplits(r.supported_splits),
  };
}

function mapZoneRow(r: VenueFieldZoneRow): VenueFieldZoneRow {
  return {
    ...r,
    layout_kind:
      r.layout_kind ??
      (r.blocks_entire_field ? 'entire' : layoutKindFromCode(r.zone_code)),
  };
}

export async function listVenueFields(
  venueId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: VenueFieldRow[]; error: string | null }> {
  let q = supabase
    .from('venue_fields')
    .select(FIELD_SELECT)
    .eq('venue_id', venueId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  let { data, error } = await q;
  if (error && isPlatz4ColumnMissing(error.message)) {
    let q2 = supabase
      .from('venue_fields')
      .select(FIELD_SELECT_LEGACY)
      .eq('venue_id', venueId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts?.includeInactive) q2 = q2.eq('is_active', true);
    ({ data, error } = await q2);
  }
  if (error) {
    if (isFieldsMigrationPending(error.message)) {
      return { data: [], error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return {
    data: ((data ?? []) as VenueFieldRow[]).map(mapFieldRow),
    error: null,
  };
}

export async function listVenueFieldsForClub(
  clubId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: VenueFieldRow[]; error: string | null }> {
  let q = supabase
    .from('venue_fields')
    .select(FIELD_SELECT)
    .eq('club_id', clubId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  let { data, error } = await q;
  if (error && isPlatz4ColumnMissing(error.message)) {
    let q2 = supabase
      .from('venue_fields')
      .select(FIELD_SELECT_LEGACY)
      .eq('club_id', clubId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts?.includeInactive) q2 = q2.eq('is_active', true);
    ({ data, error } = await q2);
  }
  if (error) {
    if (isFieldsMigrationPending(error.message)) {
      return { data: [], error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return {
    data: ((data ?? []) as VenueFieldRow[]).map(mapFieldRow),
    error: null,
  };
}

export async function createVenueField(input: {
  venueId: string;
  clubId: string;
  name: string;
  fieldType?: VenueFieldType;
  colorHex?: string | null;
  sortOrder?: number;
  supportedSplits?: FieldSplitDemand[];
  seedStandardZones?: boolean;
}): Promise<{ data: VenueFieldRow | null; error: string | null }> {
  const name = String(input.name ?? '').trim();
  if (!name) return { data: null, error: 'Platzname ist Pflicht.' };
  const payload: Record<string, unknown> = {
    venue_id: input.venueId,
    club_id: input.clubId,
    name,
    field_type: input.fieldType ?? 'other',
    color_hex: nullIfEmpty(input.colorHex),
    sort_order: input.sortOrder ?? 0,
    is_active: true,
  };
  if (input.supportedSplits) payload.supported_splits = input.supportedSplits;
  let { data, error } = await supabase.from('venue_fields').insert(payload).select(FIELD_SELECT).maybeSingle();
  if (error && isPlatz4ColumnMissing(error.message)) {
    delete payload.supported_splits;
    ({ data, error } = await supabase.from('venue_fields').insert(payload).select(FIELD_SELECT_LEGACY).maybeSingle());
  }
  if (error) {
    if (isFieldsMigrationPending(error.message)) {
      return { data: null, error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    if (/duplicate|unique/i.test(error.message)) return { data: null, error: 'Dieser Platzname existiert bereits.' };
    return { data: null, error: error.message };
  }
  const row = mapFieldRow(data as VenueFieldRow);
  if (input.seedStandardZones !== false && row?.id) {
    await ensureStandardFieldZones(row.id);
  }
  return { data: row, error: null };
}

export async function updateVenueField(
  fieldId: string,
  patch: {
    name?: string;
    fieldType?: VenueFieldType;
    colorHex?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    supportedSplits?: FieldSplitDemand[];
  },
): Promise<{ data: VenueFieldRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = String(patch.name).trim();
  if (patch.fieldType !== undefined) payload.field_type = patch.fieldType;
  if (patch.colorHex !== undefined) payload.color_hex = nullIfEmpty(patch.colorHex);
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) payload.is_active = patch.isActive;
  if (patch.supportedSplits !== undefined) payload.supported_splits = patch.supportedSplits;
  let { data, error } = await supabase
    .from('venue_fields')
    .update(payload)
    .eq('id', fieldId)
    .select(FIELD_SELECT)
    .maybeSingle();
  if (error && isPlatz4ColumnMissing(error.message)) {
    delete payload.supported_splits;
    ({ data, error } = await supabase
      .from('venue_fields')
      .update(payload)
      .eq('id', fieldId)
      .select(FIELD_SELECT_LEGACY)
      .maybeSingle());
  }
  if (error) return { data: null, error: error.message };
  return { data: data ? mapFieldRow(data as VenueFieldRow) : null, error: null };
}

export async function listFieldZones(
  fieldId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: VenueFieldZoneRow[]; error: string | null }> {
  let q = supabase
    .from('venue_field_zones')
    .select(ZONE_SELECT)
    .eq('field_id', fieldId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  let { data, error } = await q;
  if (error && isPlatz4ColumnMissing(error.message)) {
    let q2 = supabase
      .from('venue_field_zones')
      .select(ZONE_SELECT_LEGACY)
      .eq('field_id', fieldId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts?.includeInactive) q2 = q2.eq('is_active', true);
    ({ data, error } = await q2);
  }
  if (error) {
    if (isFieldsMigrationPending(error.message)) {
      return { data: [], error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return { data: ((data ?? []) as VenueFieldZoneRow[]).map(mapZoneRow), error: null };
}

/** PLATZ.4: Standardzonen idempotent (RPC; Fallback: no-op wenn Migration fehlt). */
export async function ensureStandardFieldZones(
  fieldId: string,
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('ensure_standard_field_zones', { p_field_id: fieldId });
  if (!error) return { count: Number(data ?? 0), error: null };
  if (/ensure_standard_field_zones|42883|does not exist|schema cache/i.test(error.message)) {
    return { count: 0, error: null };
  }
  return { count: 0, error: error.message };
}

export async function createFieldZone(input: {
  fieldId: string;
  clubId: string;
  name: string;
  blocksEntireField?: boolean;
  sortOrder?: number;
}): Promise<{ data: VenueFieldZoneRow | null; error: string | null }> {
  const name = String(input.name ?? '').trim();
  if (!name) return { data: null, error: 'Teilflächenname ist Pflicht.' };
  const payload = {
    field_id: input.fieldId,
    club_id: input.clubId,
    name,
    blocks_entire_field: input.blocksEntireField === true,
    sort_order: input.sortOrder ?? 0,
    is_active: true,
  };
  let { data, error } = await supabase
    .from('venue_field_zones')
    .insert(payload)
    .select(ZONE_SELECT)
    .maybeSingle();
  if (error && isPlatz4ColumnMissing(error.message)) {
    ({ data, error } = await supabase
      .from('venue_field_zones')
      .insert(payload)
      .select(ZONE_SELECT_LEGACY)
      .maybeSingle());
  }
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { data: null, error: 'Diese Teilfläche existiert bereits.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapZoneRow(data as VenueFieldZoneRow) : null, error: null };
}

export async function updateFieldZone(
  zoneId: string,
  patch: { name?: string; blocksEntireField?: boolean; sortOrder?: number; isActive?: boolean },
): Promise<{ data: VenueFieldZoneRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = String(patch.name).trim();
  if (patch.blocksEntireField !== undefined) payload.blocks_entire_field = patch.blocksEntireField;
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) payload.is_active = patch.isActive;
  let { data, error } = await supabase
    .from('venue_field_zones')
    .update(payload)
    .eq('id', zoneId)
    .select(ZONE_SELECT)
    .maybeSingle();
  if (error && isPlatz4ColumnMissing(error.message)) {
    ({ data, error } = await supabase
      .from('venue_field_zones')
      .update(payload)
      .eq('id', zoneId)
      .select(ZONE_SELECT_LEGACY)
      .maybeSingle());
  }
  if (error) return { data: null, error: error.message };
  return { data: data ? mapZoneRow(data as VenueFieldZoneRow) : null, error: null };
}
