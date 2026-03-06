/**
 * Zentrale Rollen- und Permission-Utilities.
 * memberships.role aus der DB kann gemischt sein (z. B. "Trainer", "Administrator");
 * normalizeRole() mappt auf einheitliche RoleKeys.
 */

export type RoleKey =
  | 'admin'
  | 'trainer'
  | 'parent'
  | 'player'
  | 'fan'
  | 'co_trainer'
  | 'head_coach';

const CANONICAL_ROLES: RoleKey[] = ['admin', 'trainer', 'parent', 'player', 'fan'];

/**
 * Normalisiert einen Rohtext aus der DB auf einen RoleKey (oder null bei leer/unbekannt).
 * - trim + lowercase
 * - administrator -> admin
 * - head_coach -> trainer
 * - coach -> trainer
 * - co_trainer -> trainer
 */
export function normalizeRole(input: string | null | undefined): RoleKey | null {
  const s = (input ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'administrator') return 'admin';
  if (s === 'admin') return 'admin';
  if (s === 'head_coach' || s === 'headcoach') return 'trainer';
  if (s === 'coach') return 'trainer';
  if (s === 'co_trainer' || s === 'co-trainer' || s === 'co trainer') return 'trainer';
  if (s === 'trainer') return 'trainer';
  if (s === 'parent' || s === 'eltern') return 'parent';
  if (s === 'player' || s === 'spieler') return 'player';
  if (s === 'fan') return 'fan';
  if (CANONICAL_ROLES.includes(s as RoleKey)) return s as RoleKey;
  return null;
}

/** Deutsche Labels für alle RoleKeys (z. B. für Anzeige in UI). */
export const ROLE_LABELS_DE: Record<RoleKey, string> = {
  admin: 'Administrator',
  trainer: 'Trainer',
  parent: 'Eltern',
  player: 'Spieler',
  fan: 'Fan',
  co_trainer: 'Co-Trainer',
  head_coach: 'Cheftrainer',
};

/** Darf Spiele anlegen/bearbeiten/löschen (Spielplan). */
export function canManageMatches(role: RoleKey | null): boolean {
  return role === 'trainer' || role === 'admin';
}

/** Darf Kader/Roster verwalten. */
export function canManageRoster(role: RoleKey | null): boolean {
  return role === 'trainer' || role === 'admin';
}

/** Darf Team-Einstellungen verwalten. */
export function canManageTeam(role: RoleKey | null): boolean {
  return role === 'trainer' || role === 'admin';
}

/** Darf Treffpunkt (meetup_at) sehen – Spieler, Eltern, Trainer, Admin; Fans nicht. */
export function canSeeMeetup(role: RoleKey | null): boolean {
  return role === 'player' || role === 'parent' || role === 'trainer' || role === 'admin';
}
