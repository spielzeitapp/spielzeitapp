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
  user_count: number;
  active_player_count: number;
  enabled_module_count: number;
  available_module_count: number;
  last_activity_at: string | null;
};

export type PlatformDashboardStats = {
  active_clubs: number;
  archived_clubs: number;
  teams: number;
  active_seasons: number;
  users: number;
  active_players: number;
  clubs_without_active_season: number;
};

export type ClubModule = {
  module_key: string;
  name: string;
  description: string;
  category: 'core' | 'sport' | 'content' | 'administration';
  is_core: boolean;
  availability: 'ready' | 'planned' | 'beta';
  enabled: boolean;
  sort_order: number;
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
    user_count: Number(raw.user_count ?? 0),
    active_player_count: Number(raw.active_player_count ?? 0),
    enabled_module_count: Number(raw.enabled_module_count ?? 0),
    available_module_count: Number(raw.available_module_count ?? 0),
    last_activity_at: raw.last_activity_at != null ? String(raw.last_activity_at) : null,
  };
}

export async function listPlatformClubs(opts?: {
  status?: 'active' | 'archived' | 'all' | null;
  search?: string | null;
}): Promise<{ data: ClubListRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_clubs_v2', {
    p_status: opts?.status ?? 'all',
    p_search: opts?.search ?? null,
  });
  if (error) return { data: [], error: rpcErrorMessage(error) };
  const rows = Array.isArray(data) ? data.map((r) => mapListRow(r as Record<string, unknown>)) : [];
  return { data: rows, error: null };
}

export async function getPlatformDashboard(): Promise<{
  data: PlatformDashboardStats | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_get_platform_dashboard');
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as PlatformDashboardStats | null, error: null };
}

export async function listClubModules(
  clubId: string,
): Promise<{ data: ClubModule[]; error: string | null }> {
  const { data, error } = await supabase.rpc('club_effective_modules', { p_club_id: clubId });
  if (error) return { data: [], error: rpcErrorMessage(error) };
  return { data: (Array.isArray(data) ? data : []) as ClubModule[], error: null };
}

export async function adminSetClubModule(input: {
  clubId: string;
  moduleKey: string;
  enabled: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_club_module', {
    p_club_id: input.clubId,
    p_module_key: input.moduleKey,
    p_enabled: input.enabled,
  });
  return { error: error ? rpcErrorMessage(error) : null };
}

export async function adminLogSupportAccess(input: {
  clubId: string;
  action: 'support_started' | 'support_ended';
  teamSeasonId?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_log_support_access', {
    p_club_id: input.clubId,
    p_action: input.action,
    p_team_season_id: input.teamSeasonId ?? null,
  });
  return { error: error ? rpcErrorMessage(error) : null };
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

export type AdminCreateTeamResult = {
  status: string;
  team_id: string;
  name?: string;
  age_group?: string | null;
};

export async function adminCreateTeam(input: {
  clubId: string;
  name: string;
  ageGroup?: string | null;
}): Promise<{ data: AdminCreateTeamResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_team', {
    p_club_id: input.clubId,
    p_name: input.name,
    p_age_group: input.ageGroup ?? null,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: data as AdminCreateTeamResult, error: null };
}

export async function adminEnsureTeamSeason(input: {
  teamId: string;
  seasonName: string;
  status?: 'active' | 'draft';
  displayName?: string | null;
  ageGroup?: string | null;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_ensure_team_season', {
    p_team_id: input.teamId,
    p_season_name: input.seasonName,
    p_status: input.status ?? 'active',
    p_display_name: input.displayName ?? null,
    p_age_group: input.ageGroup ?? null,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as Record<string, unknown> | null, error: null };
}

export async function adminAssignTeamSeasonStaff(input: {
  teamSeasonId: string;
  userId: string;
  role?: 'trainer' | 'co_trainer' | 'head_coach' | 'head';
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_assign_team_season_staff', {
    p_team_season_id: input.teamSeasonId,
    p_user_id: input.userId,
    p_role: input.role ?? 'head_coach',
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as Record<string, unknown> | null, error: null };
}

export type AdminUserLookup = {
  status: string;
  user_id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_platform_admin?: boolean;
};

export async function adminLookupUserByEmail(
  email: string,
): Promise<{ data: AdminUserLookup | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_lookup_user_by_email', {
    p_email: email,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as AdminUserLookup | null, error: null };
}

export async function managerLookupStaffUserByEmail(input: {
  teamSeasonId: string;
  email: string;
}): Promise<{ data: AdminUserLookup | null; error: string | null }> {
  const { data, error } = await supabase.rpc('manager_lookup_staff_user_by_email', {
    p_team_season_id: input.teamSeasonId,
    p_email: input.email,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as AdminUserLookup | null, error: null };
}

export async function adminAssignClubAdmin(input: {
  clubId: string;
  userId: string;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_assign_club_admin', {
    p_club_id: input.clubId,
    p_user_id: input.userId,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as Record<string, unknown> | null, error: null };
}

export async function adminSetTeamSeasonVenueGrant(input: {
  teamSeasonId: string;
  venueId: string;
  purpose: 'training' | 'home_match';
  isActive?: boolean;
  sortOrder?: number;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_set_team_season_venue_grant', {
    p_team_season_id: input.teamSeasonId,
    p_venue_id: input.venueId,
    p_purpose: input.purpose,
    p_is_active: input.isActive ?? true,
    p_sort_order: input.sortOrder ?? 0,
  });
  if (error) return { data: null, error: rpcErrorMessage(error) };
  return { data: (data ?? null) as Record<string, unknown> | null, error: null };
}

export type GrantableVenue = {
  id: string;
  name: string;
  club_id: string;
  club_name: string;
  is_active: boolean;
};

export async function adminListGrantableVenues(): Promise<{
  data: GrantableVenue[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_list_grantable_venues');
  if (error) return { data: [], error: rpcErrorMessage(error) };
  const rows = Array.isArray(data) ? (data as GrantableVenue[]) : [];
  return { data: rows, error: null };
}
