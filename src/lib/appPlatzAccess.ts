/**
 * APP-PLATZ.1 – Sichtbarkeit der mobilen Platzbelegung (kein neuer Rollenpfad).
 */
import { canManageMatches, normalizeRole, type RoleKey } from './roles';
import { canAccessManager, type ManagerMembershipLike } from '../manager/canAccessManager';

/** Trainer / Co / Head / Vereinsadmin / Plattformadmin — nicht Eltern/Spieler/Fan. */
export function canSeeAppPlatzbelegung(opts: {
  effectiveRole: string | null | undefined;
  backendRole: string | null | undefined;
  memberships?: readonly ManagerMembershipLike[] | null;
}): boolean {
  const er = normalizeRole(opts.effectiveRole);
  const br = normalizeRole(opts.backendRole);
  if (er === 'parent' || er === 'player' || er === 'fan') return false;
  if (br === 'parent' || br === 'player' || br === 'fan') return false;

  if (canManageMatches(er) || canManageMatches(br)) return true;
  if (br === 'admin' || er === 'admin') return true;

  const raw = [
    String(opts.effectiveRole ?? ''),
    String(opts.backendRole ?? ''),
  ].map((s) => s.trim().toLowerCase());
  if (raw.some((r) => r === 'club_admin' || r === 'vereinsadmin' || r === 'platform_admin')) {
    return true;
  }

  return canAccessManager(opts.backendRole, opts.memberships ?? []);
}

export function isStaffPlatzRole(role: RoleKey | null): boolean {
  return canManageMatches(role) || role === 'admin';
}
