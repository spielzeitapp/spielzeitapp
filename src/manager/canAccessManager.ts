/**
 * Manager-Zugriff über bestehende Staff-Logik (keine neuen Rollen).
 * Entspricht dem Muster in InternalLayout.hasStaffAccess.
 */

import { canManageMatches, normalizeRole } from '../lib/roles';

export type ManagerMembershipLike = { role?: string | null };

/** Backend- oder Membership-Staff (Trainer / Co / Head / Admin). */
export function canAccessManager(
  backendRole: string | null | undefined,
  memberships: readonly ManagerMembershipLike[],
): boolean {
  const backendKey = normalizeRole(backendRole);
  if (backendKey === 'admin' || backendKey === 'trainer') return true;
  return memberships.some((m) => canManageMatches(normalizeRole(m.role)));
}

/** Staff für die aktuell gewählte Mannschaftssaison. */
export function canAccessManagerForMembership(
  backendRole: string | null | undefined,
  membershipRole: string | null | undefined,
): boolean {
  const backendKey = normalizeRole(backendRole);
  if (backendKey === 'admin' || backendKey === 'trainer') return true;
  return canManageMatches(normalizeRole(membershipRole));
}
