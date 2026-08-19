/**
 * TRAINER-MODE.1 – Arbeitsmodus (UI-Kontext, keine DB-Rollenänderung).
 * Sicherheit bleibt bei RPCs, RLS und bestehender Staff-/Plattformadmin-Logik.
 */

import { normalizeRole } from '../lib/roles';
import { isSeasonActive, isSeasonArchived } from '../lib/seasonLifecycle';

export type ManagerWorkMode = 'trainer' | 'platform_admin' | 'club_admin';

export const MANAGER_WORK_MODE_STORAGE_KEY = 'spielzeit_manager_work_mode';
export const MANAGER_TRAINER_TEAM_SEASON_STORAGE_KEY = 'spielzeit_manager_trainer_team_season';

export type ManagerWorkModeMembership = {
  team_season_id: string;
  role?: string | null;
};

const TRAINER_STAFF_ROLES = new Set(['trainer', 'co_trainer', 'head_coach', 'head']);

export function isPlatformAdminBackendRole(backendRole: string | null | undefined): boolean {
  return normalizeRole(backendRole) === 'admin';
}

/** Trainer-/Co-/Cheftrainer-Membership (kein Vereinsadmin). */
export function isTrainerStaffMembershipRole(role: string | null | undefined): boolean {
  const r = String(role ?? '')
    .trim()
    .toLowerCase();
  return TRAINER_STAFF_ROLES.has(r);
}

/** Vereinsadmin über memberships.role = admin (nicht user_roles). */
export function isClubAdminMembershipRole(role: string | null | undefined): boolean {
  return String(role ?? '').trim().toLowerCase() === 'admin';
}

export function hasTrainerStaffMembership(
  memberships: readonly ManagerWorkModeMembership[],
): boolean {
  return memberships.some((m) => isTrainerStaffMembershipRole(m.role));
}

export function hasClubAdminMembership(
  memberships: readonly ManagerWorkModeMembership[],
): boolean {
  return memberships.some((m) => isClubAdminMembershipRole(m.role));
}

/** Verfügbare Arbeitsmodi – keine Duplikate, stabile Reihenfolge. */
export function resolveAvailableWorkModes(input: {
  backendRole: string | null | undefined;
  memberships: readonly ManagerWorkModeMembership[];
}): ManagerWorkMode[] {
  const modes: ManagerWorkMode[] = [];
  if (hasTrainerStaffMembership(input.memberships)) modes.push('trainer');
  if (hasClubAdminMembership(input.memberships)) modes.push('club_admin');
  if (isPlatformAdminBackendRole(input.backendRole)) modes.push('platform_admin');
  return modes;
}

export function resolveDefaultWorkMode(available: readonly ManagerWorkMode[]): ManagerWorkMode {
  if (available.includes('trainer')) return 'trainer';
  if (available.includes('platform_admin')) return 'platform_admin';
  if (available.includes('club_admin')) return 'club_admin';
  return 'trainer';
}

function storageKey(userId: string): string {
  return `${MANAGER_WORK_MODE_STORAGE_KEY}:${userId}`;
}

export function readStoredWorkMode(userId: string | null | undefined): ManagerWorkMode | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw === 'trainer' || raw === 'platform_admin' || raw === 'club_admin') return raw;
  } catch {
    // ignore
  }
  return null;
}

export function writeStoredWorkMode(
  userId: string | null | undefined,
  mode: ManagerWorkMode,
): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), mode);
  } catch {
    // ignore
  }
}

export function resolveEffectiveWorkMode(input: {
  userId: string | null | undefined;
  backendRole: string | null | undefined;
  memberships: readonly ManagerWorkModeMembership[];
}): ManagerWorkMode {
  const available = resolveAvailableWorkModes(input);
  if (available.length === 0) return 'trainer';
  if (available.length === 1) return available[0]!;
  const stored = readStoredWorkMode(input.userId);
  if (stored && available.includes(stored)) return stored;
  return resolveDefaultWorkMode(available);
}

export function isTrainerWorkMode(mode: ManagerWorkMode): boolean {
  return mode === 'trainer';
}

export function isAdministrationWorkMode(mode: ManagerWorkMode): boolean {
  return mode === 'platform_admin' || mode === 'club_admin';
}

function trainerTeamSeasonStorageKey(userId: string): string {
  return `${MANAGER_TRAINER_TEAM_SEASON_STORAGE_KEY}:${userId}`;
}

export function readStoredTrainerTeamSeasonId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(trainerTeamSeasonStorageKey(userId));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeStoredTrainerTeamSeasonId(
  userId: string | null | undefined,
  teamSeasonId: string | null | undefined,
): void {
  if (!userId) return;
  try {
    const id = String(teamSeasonId ?? '').trim();
    if (!id) {
      window.localStorage.removeItem(trainerTeamSeasonStorageKey(userId));
      return;
    }
    window.localStorage.setItem(trainerTeamSeasonStorageKey(userId), id);
  } catch {
    // ignore
  }
}

/** Trainer-Team-Saison wählen: gespeichert → aktiv → einzige gültige. */
export function resolveTrainerTeamSeasonId(opts: {
  userId: string | null | undefined;
  trainerTeamSeasons: readonly { id: string; status?: string | null }[];
}): string | null {
  const seasons = opts.trainerTeamSeasons.filter((ts) => Boolean(ts.id));
  if (seasons.length === 0) return null;

  const validIds = new Set(seasons.map((ts) => ts.id));
  const stored = readStoredTrainerTeamSeasonId(opts.userId);
  if (stored && validIds.has(stored)) return stored;

  const active = seasons.filter(
    (ts) => isSeasonActive(ts.status) && !isSeasonArchived(ts.status),
  );
  if (active.length === 1) return active[0]!.id;
  if (active.length > 1) return active[0]!.id;

  return seasons[0]!.id;
}

/** Membership-Rolle darf nicht durch Session-Normalisierung verfälscht werden. */
export function isTrainerStaffMembershipRoleRaw(role: string | null | undefined): boolean {
  const r = String(role ?? '')
    .trim()
    .toLowerCase();
  return TRAINER_STAFF_ROLES.has(r);
}

/** Team-Saisons mit Trainer-Staff-Rolle (Trainer-Arbeitskontext). */
export function filterTrainerStaffTeamSeasonIds(
  memberships: readonly ManagerWorkModeMembership[],
): string[] {
  const ids = new Set<string>();
  for (const m of memberships) {
    if (!m.team_season_id) continue;
    if (isTrainerStaffMembershipRoleRaw(m.role)) ids.add(m.team_season_id);
    else if (isTrainerStaffMembershipRole(m.role)) ids.add(m.team_season_id);
  }
  return [...ids];
}

export function canSwitchWorkMode(available: readonly ManagerWorkMode[]): boolean {
  return available.length > 1;
}

export function workModeHomePath(mode: ManagerWorkMode): string {
  if (mode === 'platform_admin') return '/manager/vereine';
  if (mode === 'club_admin') return '/manager/saisons';
  return '/manager';
}

export function adminSwitchLabel(mode: ManagerWorkMode): string {
  if (mode === 'platform_admin') return 'Zur Plattformverwaltung';
  return 'Zur Vereinsverwaltung';
}

/** Admin-only Manager-Routen (UI-Guard; Server bleibt maßgeblich). */
export function isAdminOnlyManagerLocation(pathname: string, search: string): boolean {
  if (pathname.startsWith('/manager/vereine')) return true;
  const tab = new URLSearchParams(search).get('tab');
  if (pathname.startsWith('/manager/platzbelegung') && tab === 'facilities') return true;
  return false;
}

export function navItemVisibleForWorkMode(
  item: {
    platformAdminOnly?: boolean;
    hideInTrainerMode?: boolean;
    clubAdminOnly?: boolean;
  },
  mode: ManagerWorkMode,
): boolean {
  if (mode === 'platform_admin') return true;
  if (item.platformAdminOnly) return false;
  if (mode === 'trainer' && item.hideInTrainerMode) return false;
  if (mode === 'trainer' && item.clubAdminOnly) return false;
  return true;
}

/** Erweiterte Admin-Fähigkeiten in Platzbelegung (nicht UI-Modus allein). */
export function managerUsesExpandedAdminCapabilities(
  workMode: ManagerWorkMode,
  backendRole: string | null | undefined,
  memberships: readonly ManagerWorkModeMembership[],
): boolean {
  if (isTrainerWorkMode(workMode)) return false;
  if (workMode === 'platform_admin') return isPlatformAdminBackendRole(backendRole);
  if (workMode === 'club_admin') return hasClubAdminMembership(memberships);
  return false;
}
