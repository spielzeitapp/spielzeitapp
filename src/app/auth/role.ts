/**
 * Backend-Rolle: useSession lädt aus public.user_roles und schreibt spielzeit_role.
 * getBackendRole() liest spielzeit_role (kein Fallback).
 * UI-Preview (dev_ui_role) nur wenn Backend admin oder head_coach.
 */

export type UiRole = 'viewer' | 'parent' | 'trainer' | 'head_coach' | 'admin';

const BACKEND_ROLE_KEY = 'spielzeit_role';
const DEV_UI_ROLE_KEY = 'dev_ui_role';
const DEV_ROLE_SWITCH_KEY = 'dev_role_switch';

/** Backend-Rollen (rbac/Session); "admin" für spätere Erweiterung. */
export const BACKEND_ROLES_ALLOWING_DEV_UI_OVERRIDE = ['admin', 'head_coach'] as const;

function getStored(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStored(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeStored(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Liest die Backend-Rolle aus der Quelle (useSession schreibt nach user_roles-Load in spielzeit_role).
 * Kein Fallback – leer wenn noch nicht geladen oder kein DB-Eintrag.
 */
export function getBackendRole(): string {
  const raw = getStored(BACKEND_ROLE_KEY);
  return raw ?? '';
}

/**
 * Mappt Backend-Rolle auf einheitliches UiRole.
 */
export function normalizeToUiRole(backendRole: string): UiRole {
  switch (backendRole) {
    case 'trainer':
    case 'co_trainer':
      return 'trainer';
    case 'head_coach':
      return 'head_coach';
    case 'admin':
      return 'admin';
    case 'parent':
      return 'parent';
    case 'fan':
    case 'player':
    default:
      return 'viewer';
  }
}

/**
 * Mappt Session-effectiveRole (+ Fallback aus user_roles) auf UiRole.
 * Globales admin in user_roles wird nicht priorisiert, wenn Memberships existieren aber effectiveRole leer ist
 * (verhindert Admin-UI statt Trainer/Eltern bei Test-Usern mit admin + Team-Membership).
 */
export function effectiveRoleToUiRole(
  effectiveRole: string,
  fallbackBackend: string,
  hasMemberships: boolean,
): UiRole {
  const e = (effectiveRole ?? '').trim().toLowerCase();
  if (e === 'trainer' || e === 'co_trainer') return 'trainer';
  if (e === 'head_coach') return 'head_coach';
  if (e === 'parent') return 'parent';
  if (e === 'admin') return 'admin';
  if (e === 'fan' || e === 'player') return 'viewer';
  if (!e && hasMemberships) return 'viewer';
  const fb = normalizeToUiRole(fallbackBackend || '');
  if (!e && fb === 'admin') return 'viewer';
  return fb;
}

/** DEV-Testrolle aus localStorage, nur wenn erlaubt; sonst null. */
export function readDevUiOverrideIfAllowed(): UiRole | null {
  if (!isDevMode()) return null;
  const backend = getBackendRole();
  if (!backend || !BACKEND_ROLES_ALLOWING_DEV_UI_OVERRIDE.includes(backend as 'admin' | 'head_coach'))
    return null;
  const override = getStored(DEV_UI_ROLE_KEY);
  if (override && ['viewer', 'parent', 'trainer', 'head_coach', 'admin'].includes(override)) {
    return override as UiRole;
  }
  return null;
}

/**
 * DEV_MODE ist aktiv wenn:
 * - import.meta.env.MODE !== 'production'
 * - ODER URL hat ?dev=1
 * - ODER localStorage dev_role_switch == "1"
 */
export function isDevMode(): boolean {
  if (import.meta.env.MODE && import.meta.env.MODE !== 'production') return true;
  if (typeof window !== 'undefined') {
    if (new URLSearchParams(window.location.search).get('dev') === '1') return true;
    if (getStored(DEV_ROLE_SWITCH_KEY) === '1') return true;
  }
  return false;
}

/**
 * UI-Rolle: DEV-Override (nur wenn DEV_MODE und Backend admin/head) oder normalisierte Backend-Rolle.
 */
export function getUiRole(): UiRole {
  const dev = readDevUiOverrideIfAllowed();
  if (dev) return dev;
  const backend = getBackendRole();
  return normalizeToUiRole(backend || '');
}

export function setDevUiRole(role: UiRole): void {
  setStored(DEV_UI_ROLE_KEY, role);
}

export function clearDevUiRole(): void {
  removeStored(DEV_UI_ROLE_KEY);
}

export function canEditSchedule(role: string): boolean {
  return role === 'trainer' || role === 'head_coach' || role === 'admin';
}

export function canUseLiveControls(role: string): boolean {
  return role === 'trainer' || role === 'head_coach' || role === 'admin';
}

/** Prüft, ob aktuell eine DEV-Testrolle aktiv ist (uiRole !== normalized backend). */
export function hasDevOverride(): boolean {
  if (!isDevMode()) return false;
  const backend = getBackendRole();
  if (!BACKEND_ROLES_ALLOWING_DEV_UI_OVERRIDE.includes(backend as 'admin' | 'head_coach')) return false;
  const override = getStored(DEV_UI_ROLE_KEY);
  return override != null && override !== '' && override !== normalizeToUiRole(backend);
}
