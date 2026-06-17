import { normalizeRole as normalizeSessionRole } from '../auth/useSession';
import type { Membership } from '../auth/useSession';
import { supabase } from './supabaseClient';
import { canManageMatches, normalizeRole as normalizeRoleKey } from './roles';
import {
  getVapidPublicKey,
  isPushBrowserSupported,
  isPushFullyActive,
} from './pushSubscriptionCore';
import { shouldDeferPushOnboardingPrompt } from './pushOnboardingPrompt';

export const PUSH_ONBOARDING_EXEMPT_PATHS = [
  '/app/parent-onboarding',
  '/app/fan-onboarding',
  '/app/role-choice',
  '/app/set-password',
  '/app/player-onboarding',
  '/app/intro/splash',
  '/app/intro/welcome',
] as const;

export function isPushOnboardingExemptPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/app') return true;
  return PUSH_ONBOARDING_EXEMPT_PATHS.some(
    (p) => clean === p || clean.startsWith(`${p}/`),
  );
}

function hasStaffAccess(backendRole: string, memberships: { role?: string | null }[]): boolean {
  const backendKey = normalizeRoleKey(backendRole);
  if (backendKey === 'admin' || backendKey === 'trainer') return true;
  return memberships.some((m) => canManageMatches(normalizeRoleKey(m.role)));
}

/** Rollen mit Push-Hinweis (nicht Fan). */
export function isPushOnboardingEligibleRole(
  effectiveRole: string,
  backendRole: string,
): boolean {
  if (normalizeRoleKey(backendRole) === 'admin') return true;
  const r = normalizeSessionRole(effectiveRole);
  if (r === 'fan' || r === '') return false;
  return r === 'parent' || r === 'player' || r === 'trainer';
}

/** Spiegel des Onboarding-Gates in InternalLayout – true = Nutzer darf die App normal nutzen. */
export async function isUserOnboardingComplete(params: {
  userId: string;
  backendRole: string;
  previewRole: string | null;
  memberships: Membership[];
}): Promise<boolean> {
  const { userId, backendRole, previewRole, memberships } = params;
  const membershipList = memberships ?? [];

  if (hasStaffAccess(backendRole, membershipList)) return true;

  const preview = normalizeSessionRole(previewRole ?? '') ?? '';
  const hasParentMembership = membershipList.some(
    (m) => normalizeSessionRole(m.role) === 'parent',
  );
  const hasPlayerMembership = membershipList.some(
    (m) => normalizeSessionRole(m.role) === 'player',
  );
  const hasFanMembership = membershipList.some(
    (m) => normalizeSessionRole(m.role) === 'fan',
  );

  const pgRes = await supabase
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId)
    .limit(1);
  const hasGuardian = !pgRes.error && (pgRes.data ?? []).length > 0;

  if (hasParentMembership && hasGuardian) return true;
  if (hasFanMembership) return true;
  if (
    preview === 'fan' &&
    !hasParentMembership &&
    !hasPlayerMembership &&
    !hasGuardian
  ) {
    return false;
  }
  if (preview === 'player' && !hasPlayerMembership) return false;
  if (hasPlayerMembership) return true;

  const needsParentOnboarding =
    preview === 'parent' ||
    normalizeSessionRole(backendRole) === 'parent' ||
    hasParentMembership ||
    hasGuardian;

  if (needsParentOnboarding) return false;

  if (membershipList.length === 0 && !hasGuardian) return false;

  return true;
}

export type PushOnboardingGateInput = {
  userId: string | undefined;
  sessionLoading: boolean;
  effectiveRole: string;
  backendRole: string;
  previewRole: string | null;
  memberships: Membership[];
  pathname: string;
  permission: NotificationPermission;
  subscriptionActive: boolean;
  pushInitDone: boolean;
  browserOk: boolean;
  onboardingComplete: boolean | null;
};

export function evaluatePushOnboardingGate(input: PushOnboardingGateInput): boolean {
  const {
    userId,
    sessionLoading,
    effectiveRole,
    backendRole,
    pathname,
    permission,
    subscriptionActive,
    pushInitDone,
    browserOk,
    onboardingComplete,
  } = input;

  if (!userId || sessionLoading) return false;
  if (!pushInitDone || !browserOk) return false;
  if (!getVapidPublicKey()) return false;
  if (isPushOnboardingExemptPath(pathname)) return false;
  if (onboardingComplete !== true) return false;
  if (!isPushOnboardingEligibleRole(effectiveRole, backendRole)) return false;
  if (permission === 'denied') return false;
  if (isPushFullyActive(permission, subscriptionActive)) return false;
  if (shouldDeferPushOnboardingPrompt(userId)) return false;

  return true;
}
