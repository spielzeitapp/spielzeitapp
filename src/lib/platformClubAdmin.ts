/**
 * ADMIN-ORG.1 – Plattformadmin Vereinsverwaltung (RPC-Client).
 * Keine neuen Serverless Functions; nutzt bestehende is_admin()-RPCs.
 */

import { supabase } from './supabaseClient';

export type ClubStatus = 'active' | 'archived';

export type ClubListRow = {
  id: string;
  name: string;
  short_name: string | null;
  status: ClubStatus;
  created_at: string | null;
  archived_at: string | null;
  team_count: number;
  active_season_count: number;
  staff_admin_count: number;
};

export type ClubDependencyCounts = {
  teams: number;
  team_seasons: number;
  memberships: number;
  staff_users: number;
  venues: number;
  team_venues: number;
  opponent_catalog: number;
  venue_fields: number;
  venue_field_zones: number;
  event_field_assignments: number;
  training_exercises: number;
  training_sessions: number;
  events: number;
  total_blocking: number;
};

export type ClubDetail = {
  id: string;
  name: string;
  short_name: string | null;
  status: ClubStatus;
  created_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  updated_at: string | null;
  can_hard_delete: boolean;
  dependencies: ClubDependencyCounts;
  teams: Array<{ id: string; name: string }>;
  team_seasons: Array<{
    id: string;
    team_id: string;
    team_name: string;
    status: string;
    season_name: string | null;
    age_group: string | null;
  }>;
  staff: Array<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    roles: string[];
  }>;
  venues: Array<{ id: string; name: string }>;
};

function rpcErrorMessage(error: { message?: string; details?: string; code?: string } | null): string {
  if (!error) return 'Unbekannter Fehler';
  const msg = String(error.message ?? '');
  if (/Nur Plattformadmin|42501|permission denied/i.test(msg)) {
    return 'Keine Berechtigung für diese Aktion.';
  }
  if (/existiert bereits|23505|duplicate/i.test(msg)) {
    return 'Ein Verein mit diesem Namen existiert bereits (aktiv oder archiviert).';
  }
  if (/abhängige Daten|P0001/i.test(msg)) {
    return 'Der Verein hat abhängige Daten und kann nicht endgültig gelöscht werden. Bitte archivieren.';
  }
  if (/Bestätigungsname/i.test(msg)) {
    return 'Der Bestätigungsname stimmt nicht überein.';
  }
  if (/Pflicht|22023/i.test(msg)) {
    return 'Bitte prüfe die Eingaben (Vereinsname ist Pflicht).';
  }
  if (/nicht gefunden|P0002/i.test(msg)) {
    return 'Verein nicht gefunden.';
  }
  return msg || 'Aktion fehlgeschlagen.';
}

function mapListRow(raw: Record<string, unknown>): ClubListRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    short_name: raw.short_name != null ? String(raw.short_name) : null,
    status: (raw.status === 'archived' ? 'archived' : 'active') as ClubStatus,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
    team_count: Number(raw.team_count ?? 0),
    active_season_count: Number(raw.active_season_count ?? 0),
    staff_admin_count: Number(raw.staff_admin_count ?? 0),
  };
}

export async function listPlatformClubs(opts?: {
  status?: 'active' | 'archived' | 'all' | null;
  search?: string | null;
}): Promise<{ data: ClubListRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_clubs', {
    p_status: opts?.status ?? 'all',
    p_search: opts?.search ?? null,
  });
  if (error) return { data: [], error: rpcErrorMessage(error) };
  const rows = Array.isArray(data) ? data.map((r) => mapListRow(r as Record<string, unknown>)) : [];
  return { data: rows, error: null };
}

export async function getPlatformClub(
  clubId: string,
): Promise<{ data: ClubDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_get_club', { p_club_id: clubId });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  if (!data || typeof data !== 'object') return { data: null, error: 'Verein nicht gefunden.' };
  return { data: data as ClubDetail, error: null };
}

export async function createPlatformClub(input: {
  name: string;
  shortName?: string | null;
}): Promise<{ data: ClubDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_club', {
    p_name: input.name,
    p_short_name: input.shortName ?? null,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as ClubDetail, error: null };
}

export async function updatePlatformClub(input: {
  clubId: string;
  name: string;
  shortName?: string | null;
}): Promise<{ data: ClubDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_update_club', {
    p_club_id: input.clubId,
    p_name: input.name,
    p_short_name: input.shortName ?? null,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as ClubDetail, error: null };
}

export async function archivePlatformClub(
  clubId: string,
): Promise<{ data: ClubDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_archive_club', { p_club_id: clubId });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as ClubDetail, error: null };
}

export async function restorePlatformClub(
  clubId: string,
): Promise<{ data: ClubDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_restore_club', { p_club_id: clubId });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as ClubDetail, error: null };
}

export async function deleteEmptyPlatformClub(input: {
  clubId: string;
  confirmName: string;
}): Promise<{ data: { deleted: boolean; id: string; name: string } | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_delete_empty_club', {
    p_club_id: input.clubId,
    p_confirm_name: input.confirmName,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as { deleted: boolean; id: string; name: string }, error: null };
}

/** Client-seitige Plattformadmin-Erkennung über bestehende backendRole (user_roles). */
export function isPlatformAdminRole(backendRole: string | null | undefined): boolean {
  return String(backendRole ?? '').trim().toLowerCase() === 'admin';
}
