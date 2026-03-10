/**
 * Backend-Rolle: useSession lädt aus public.user_roles und schreibt spielzeit_role.
 * getBackendRole() liest spielzeit_role (kein Fallback).
 * UI-Preview (dev_ui_role) nur wenn Backend admin oder head_coach.
 */

export type UiRole = 'viewer' | 'parent' | 'trainer' | 'head' | 'admin';

const BACKEND_ROLE_KEY = 'spielzeit_role';
const DEV_UI_ROLE_KEY = 'dev_ui_role';
const DEV_ROLE_SWITCH_KEY = 'dev_role_switch';

/** Backend-Rollen (rbac/Session); "admin" für spätere Erweiterung. */
const BACKEND_ROLES_ALLOWING_OVERRIDE = ['admin', 'head_coach'];

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
      return 'head';
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
  const backend = getBackendRole();
  // Kein implizites Fallback mehr auf "fan" – wenn keine Backend-Rolle vorhanden ist,
  // wird auf "viewer" normalisiert.
  const normalized = normalizeToUiRole(backend || '');

  if (!isDevMode()) return normalized;
  if (!backend || !BACKEND_ROLES_ALLOWING_OVERRIDE.includes(backend)) return normalized;

  const override = getStored(DEV_UI_ROLE_KEY);
  if (override && ['viewer', 'parent', 'trainer', 'head', 'admin'].includes(override)) {
    return override as UiRole;
  }
  return normalized;
}

export function setDevUiRole(role: UiRole): void {
  setStored(DEV_UI_ROLE_KEY, role);
}

export function clearDevUiRole(): void {
  removeStored(DEV_UI_ROLE_KEY);
}

export function canEditSchedule(role: string): boolean {
  return role === 'trainer' || role === 'head' || role === 'admin';
}

export function canUseLiveControls(role: string): boolean {
  return role === 'trainer' || role === 'head' || role === 'admin';
}

/** Prüft, ob aktuell eine DEV-Testrolle aktiv ist (uiRole !== normalized backend). */
export function hasDevOverride(): boolean {
  if (!isDevMode()) return false;
  const backend = getBackendRole();
  if (!BACKEND_ROLES_ALLOWING_OVERRIDE.includes(backend)) return false;
  const override = getStored(DEV_UI_ROLE_KEY);
  return override != null && override !== '' && override !== normalizeToUiRole(backend);
}
