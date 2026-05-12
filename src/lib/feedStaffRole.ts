import { normalizeRole } from '../auth/useSession';

const STAFF_ROLES = new Set(['admin', 'head_coach', 'trainer', 'co_trainer']);

/** Trainer / Co-Trainer / Cheftrainer / Admin (Backend-Rolle oder Mitgliedschaft). */
export function canStaffManageTeamFeed(
  backendRole: string | null | undefined,
  membershipRole: string | null | undefined,
): boolean {
  const br = (backendRole ?? '').trim().toLowerCase();
  if (STAFF_ROLES.has(br)) return true;
  const mr = (membershipRole ?? '').trim();
  if (!mr) return false;
  if (STAFF_ROLES.has(mr.toLowerCase())) return true;
  const n = normalizeRole(mr);
  return n === 'trainer' || n === 'admin';
}
