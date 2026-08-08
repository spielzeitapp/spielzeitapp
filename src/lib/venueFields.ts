/**
 * Plätze und Teilflächen einer Sportanlage (venues).
 */

import { supabase } from './supabaseClient';

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
};

export type VenueFieldZoneRow = {
  id: string;
  field_id: string;
  club_id: string;
  name: string;
  blocks_entire_field: boolean;
  sort_order: number;
  is_active: boolean;
};

const FIELD_SELECT =
  'id, venue_id, club_id, name, field_type, color_hex, sort_order, is_active';
const ZONE_SELECT =
  'id, field_id, club_id, name, blocks_entire_field, sort_order, is_active';

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function normalizeFieldType(raw: string | null | undefined): VenueFieldType {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'main' || t === 'training' || t === 'artificial' || t === 'small' || t === 'hall') {
    return t;
  }
  return 'other';
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
  const { data, error } = await q;
  if (error) {
    if (/relation .*venue_fields.* does not exist|42P01/i.test(error.message)) {
      return { data: [], error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return {
    data: ((data ?? []) as VenueFieldRow[]).map((r) => ({
      ...r,
      field_type: normalizeFieldType(r.field_type),
    })),
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
  const { data, error } = await q;
  if (error) {
    if (/relation .*venue_fields.* does not exist|42P01/i.test(error.message)) {
      return { data: [], error: 'Platz-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return {
    data: ((data ?? []) as VenueFieldRow[]).map((r) => ({
      ...r,
      field_type: normalizeFieldType(r.field_type),
    })),
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
}): Promise<{ data: VenueFieldRow | null; error: string | null }> {
  const name = String(input.name ?? '').trim();
  if (!name) return { data: null, error: 'Platzname ist Pflicht.' };
  const payload = {
    venue_id: input.venueId,
    club_id: input.clubId,
    name,
    field_type: input.fieldType ?? 'other',
    color_hex: nullIfEmpty(input.colorHex),
    sort_order: input.sortOrder ?? 0,
    is_active: true,
  };
  const { data, error } = await supabase.from('venue_fields').insert(payload).select(FIELD_SELECT).maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { data: null, error: 'Dieser Platzname existiert bereits.' };
    return { data: null, error: error.message };
  }
  return { data: data as VenueFieldRow, error: null };
}

export async function updateVenueField(
  fieldId: string,
  patch: {
    name?: string;
    fieldType?: VenueFieldType;
    colorHex?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<{ data: VenueFieldRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = String(patch.name).trim();
  if (patch.fieldType !== undefined) payload.field_type = patch.fieldType;
  if (patch.colorHex !== undefined) payload.color_hex = nullIfEmpty(patch.colorHex);
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) payload.is_active = patch.isActive;
  const { data, error } = await supabase
    .from('venue_fields')
    .update(payload)
    .eq('id', fieldId)
    .select(FIELD_SELECT)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as VenueFieldRow) ?? null, error: null };
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
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as VenueFieldZoneRow[], error: null };
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
  const { data, error } = await supabase
    .from('venue_field_zones')
    .insert(payload)
    .select(ZONE_SELECT)
    .maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { data: null, error: 'Diese Teilfläche existiert bereits.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as VenueFieldZoneRow, error: null };
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
  const { data, error } = await supabase
    .from('venue_field_zones')
    .update(payload)
    .eq('id', zoneId)
    .select(ZONE_SELECT)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as VenueFieldZoneRow) ?? null, error: null };
}
