import { normalizeRole } from '../auth/useSession';

const STAFF_BACKEND_ROLES = new Set(['admin', 'head_coach', 'trainer', 'co_trainer']);
const STAFF_MEMBERSHIP_ROLES = new Set(['trainer', 'co_trainer', 'head_coach']);

/** Trainer / Co-Trainer / Cheftrainer / Admin (Backend-Rolle oder Mitgliedschaft). */
export function canStaffManageTeamFeed(
  backendRole: string | null | undefined,
  membershipRole: string | null | undefined,
): boolean {
  const br = (backendRole ?? '').trim().toLowerCase();
  if (STAFF_BACKEND_ROLES.has(br)) return true;
  const mr = (membershipRole ?? '').trim().toLowerCase();
  if (STAFF_MEMBERSHIP_ROLES.has(mr)) return true;
  const n = normalizeRole(membershipRole ?? '');
  return n === 'trainer' || n === 'admin';
}
