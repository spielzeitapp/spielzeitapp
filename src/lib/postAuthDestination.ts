/**
 * Zentrale Post-Auth-Zielwahl (Invite > Deep Link > Marken-Einstieg > Home).
 * Eigenes Modul, um Zyklen zwischen authRedirect und parentLinkInvites zu vermeiden.
 */

import { clearIntroFlowCompleted, INTRO_SPLASH_PATH } from '../app/intro/introFlowSession';
import { isSafeAuthRedirectPath, POST_AUTH_HOME_PATH } from './authRedirect';
import {
  hasOpenParentEmailInviteForMe,
  isAppIntroEntryPath,
  markPendingParentEmailInvite,
  resolvePendingParentInvitePath,
} from './parentLinkInvites';

export type PostAuthDestinationKind =
  | 'parent_invite'
  | 'deep_link'
  | 'branded_entry'
  | 'home';

export type PostAuthDestination = {
  path: string;
  kind: PostAuthDestinationKind;
  /** Full navigation (invite) — verhindert nachfolgende Router-Overrides. */
  hardReplace: boolean;
};

function isInternalAppDeepLink(path: string | null | undefined): boolean {
  if (!path || !isSafeAuthRedirectPath(path)) return false;
  if (isAppIntroEntryPath(path)) return false;
  const clean = path.split('?')[0]?.replace(/\/+$/, '') || '';
  if (clean === '/login' || clean === '/register' || clean === '/forgot-password') return false;
  if (clean === '/app/parent-invite' || clean.startsWith('/app/parent-invite/')) return false;
  if (clean === '/app') return false;
  return clean.startsWith('/app/') || clean.startsWith('/demo/');
}

/**
 * 1) Pending Parent Invite
 * 2) Expliziter sicherer Deep Link (next/from)
 * 3) Bewusster Login → Splash → Welcome
 * 4) Standard Home
 *
 * Onboarding bleibt im InternalLayout-Gate.
 */
export async function resolvePostAuthDestination(opts: {
  user?: { user_metadata?: Record<string, unknown> | null } | null;
  next?: string | null;
  from?: string | null;
  consciousLogin?: boolean;
  parentInviteFlowHint?: boolean;
}): Promise<PostAuthDestination> {
  const invitePath = resolvePendingParentInvitePath(opts.user);
  if (invitePath) {
    return { path: invitePath, kind: 'parent_invite', hardReplace: true };
  }

  try {
    if (await hasOpenParentEmailInviteForMe()) {
      markPendingParentEmailInvite();
      return { path: '/app/parent-invite', kind: 'parent_invite', hardReplace: true };
    }
  } catch {
    /* continue */
  }

  if (opts.parentInviteFlowHint) {
    return { path: '/app/parent-invite', kind: 'parent_invite', hardReplace: true };
  }

  const nextSafe = opts.next && isSafeAuthRedirectPath(opts.next) ? opts.next : null;
  const fromSafe = opts.from && isSafeAuthRedirectPath(opts.from) ? opts.from : null;

  if (nextSafe && isInternalAppDeepLink(nextSafe)) {
    return { path: nextSafe, kind: 'deep_link', hardReplace: false };
  }
  if (fromSafe && isInternalAppDeepLink(fromSafe)) {
    return { path: fromSafe, kind: 'deep_link', hardReplace: false };
  }

  if (opts.consciousLogin) {
    clearIntroFlowCompleted();
    return { path: INTRO_SPLASH_PATH, kind: 'branded_entry', hardReplace: false };
  }

  return { path: POST_AUTH_HOME_PATH, kind: 'home', hardReplace: false };
}
