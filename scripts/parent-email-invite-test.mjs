/**
 * Statische Checks für Eltern-E-Mail-Einladungen (PARENT-INVITE.1).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const migEmail = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811180000_parent_link_email_invites.sql'),
  'utf8',
);
const migPeek = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812160000_parent_invite_peek_and_season.sql'),
  'utf8',
);
const api = fs.readFileSync(path.join(root, 'api/parent/send-invite.js'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/team/PlayerGuardiansPanel.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
const authRedirect = fs.readFileSync(path.join(root, 'src/lib/authRedirect.ts'), 'utf8');
const parentLib = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
const inviteLib = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');

assert.ok(migEmail.includes('recipient_email'));
assert.ok(migEmail.includes('preview_parent_link_invite'));
assert.ok(migEmail.includes('mark_parent_link_invite_sent'));
assert.ok(migEmail.includes('email_mismatch'));
assert.ok(migEmail.includes('email_confirmed_at'));
assert.ok(migEmail.includes('SET search_path = public'));
assert.ok(migEmail.includes('REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM anon'));

assert.ok(migPeek.includes('peek_parent_link_invite'));
assert.ok(migPeek.includes('GRANT EXECUTE ON FUNCTION public.peek_parent_link_invite(text) TO anon'));
assert.ok(migPeek.includes('season_label'));
assert.ok(!migPeek.includes('shxugattqatahckhspwk'));

assert.ok(api.includes('signInWithOtp') || api.includes('/auth/v1/otp'));
assert.ok(api.includes('email_redirect_to') || api.includes('emailRedirectTo'));
assert.ok(api.includes('https://app.spielzeitapp.at'));
assert.ok(api.includes('parent_invite_refuses_live_domain'));
assert.ok(api.includes('shxugattqatahckhspwk'));
assert.ok(api.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!api.includes('VITE_SUPABASE_SERVICE'));
assert.ok(api.includes('code_fallback'));
assert.ok(api.includes('localhost'));
assert.ok(api.includes("origin: STAGING_ORIGIN"));
assert.ok(api.includes('/app/parent-invite'));
assert.ok(api.includes('resolveInviteOrigin'));
assert.ok(api.includes('parent_invite_refuses_live_supabase'));
assert.ok(!api.includes('req.headers.origin'));
assert.ok(!api.includes('x-forwarded-host'));
assert.ok(api.includes('/app/parent-invite/'));
assert.ok(api.includes('spielzeit_parent_invite_token'));
assert.ok(api.includes('email_redirect_to'));
assert.ok(api.includes('/auth/v1/otp'));
assert.ok(api.includes('create_user: !authExists') || api.includes('create_user: true'));
assert.ok(api.includes('complete_signup'));
assert.ok(api.includes('/register?'));
assert.ok(api.includes('invite_confirmed'));
assert.ok(api.includes('/login?'));
// Path-based accept still used as next= target
assert.ok(api.includes('/app/parent-invite/'));
assert.ok(!api.includes("acceptPath = `/app/parent-invite?t="));

assert.ok(panel.includes('Eltern & Verknüpfungen') || panel.includes('Eltern &amp; Verknüpfungen'));
assert.ok(panel.includes('Elternteil einladen'));
assert.ok(panel.includes('Einladung senden'));
assert.ok(panel.includes('Einladung per E-Mail senden'));
assert.ok(panel.includes('Einladungscode erstellen'));
assert.ok(panel.includes('Erneut senden'));
assert.ok(panel.includes('Verknüpfung aufheben'));
assert.ok(panel.includes('sendParentEmailInvite'));

const profileModal = fs.readFileSync(
  path.join(root, 'src/components/team/PlayerProfileModal.tsx'),
  'utf8',
);
// Trainer UI: guardians panel moved to parent-access hub (PARENT-INVITE.FINAL)
assert.ok(
  profileModal.includes('TrainerParentAccessHint') || profileModal.includes('PlayerGuardiansPanel'),
);

assert.ok(accept.includes('stashParentInviteToken'));
assert.ok(!accept.includes("navigate('/app/parent-invite', { replace: true })"));
assert.ok(accept.includes('email_mismatch'));
assert.ok(accept.includes('Einladung annehmen'));
assert.ok(accept.includes('buildParentInviteAuthNext'));
assert.ok(accept.includes('peekParentLinkInvite'));
assert.ok(accept.includes('spielzeit_team_season_id'));
assert.ok(accept.includes('seasonLabel'));
assert.ok(accept.includes('buildParentInviteAuthQuery') || accept.includes('/register?'));
assert.ok(app.includes('parent-invite'));
assert.ok(app.includes('ParentInviteAcceptPage'));

assert.ok(login.includes("searchParams.get('next')") || login.includes('searchParams.get("next")'));
assert.ok(login.includes('isSafeAuthRedirectPath'));
assert.ok(inviteLib.includes('resolvePendingParentInvitePath'));
assert.ok(inviteLib.includes('ensureParentInviteContextFromNext'));
assert.ok(inviteLib.includes('hasPendingParentInvite'));
assert.ok(inviteLib.includes('captureParentInviteTokenFromUrl'));

assert.ok(login.includes('resolvePendingParentInvitePath'));
assert.ok(login.includes('ensureParentInviteContextFromNext'));
assert.ok(login.includes('readStashedParentInviteEmail'));

const internalLayout = fs.readFileSync(
  path.join(root, 'src/app/layout/InternalLayout.tsx'),
  'utf8',
);
assert.ok(internalLayout.includes('resolvePendingParentInvitePath'));
assert.ok(internalLayout.indexOf('resolvePendingParentInvitePath') < internalLayout.indexOf('isOnboardingExemptPath(location.pathname)'));

const introEntry = fs.readFileSync(
  path.join(root, 'src/app/intro/IntroEntryRedirect.tsx'),
  'utf8',
);
assert.ok(introEntry.includes('resolvePendingParentInvitePath'));

const parentOnboarding = fs.readFileSync(
  path.join(root, 'src/pages/ParentOnboardingPage.tsx'),
  'utf8',
);
assert.ok(parentOnboarding.includes('resolvePendingParentInvitePath'));

const roleChoice = fs.readFileSync(path.join(root, 'src/pages/RoleChoicePage.tsx'), 'utf8');
assert.ok(roleChoice.includes('resolvePendingParentInvitePath'));

assert.ok(accept.includes('authLoading'));
assert.ok(accept.includes('useAuth'));
// Role may only be persisted after successful redeem — not before preview
const persistCallIdx = accept.indexOf('await persistParentRoleChoice()');
const redeemCallIdx = accept.indexOf('await redeemParentLinkInvite(token)');
assert.ok(persistCallIdx > 0 && redeemCallIdx > 0 && persistCallIdx > redeemCallIdx);
assert.ok(accept.includes('Keep ?t=') || accept.includes('buildParentInviteAuthNext'));

const supabaseClient = fs.readFileSync(path.join(root, 'src/lib/supabaseClient.ts'), 'utf8');
assert.ok(supabaseClient.includes('captureParentInviteTokenFromUrl'));
assert.ok(supabaseClient.includes('spz_parent_invite_token'));
assert.ok(register.includes('emailRedirectPath'));
assert.ok(register.includes('isParentInviteFlow'));
assert.ok(register.includes('inviteEmailLocked') || register.includes('lockedEmail'));
assert.ok(authRedirect.includes('isSafeAuthRedirectPath'));

assert.ok(parentLib.includes('email_mismatch'));
assert.ok(inviteLib.includes('sendParentEmailInvite'));
assert.ok(inviteLib.includes('/api/parent/send-invite'));
assert.ok(inviteLib.includes('peekParentLinkInvite'));
assert.ok(inviteLib.includes('PARENT_INVITE_TOKEN_LOCAL_KEY'));
assert.ok(inviteLib.includes('buildParentInviteAuthNext'));
assert.ok(inviteLib.includes('/app/parent-invite/'));
assert.ok(inviteLib.includes('readParentInviteTokenFromUserMetadata'));
assert.ok(inviteLib.includes('isAppIntroEntryPath'));
assert.ok(login.includes('window.location.replace') || login.includes('window.location.assign'));
assert.ok(login.includes('readParentInviteTokenFromUserMetadata'));
assert.ok(accept.includes('useParams'));
assert.ok(app.includes('app/parent-invite/:token'));

assert.ok(parentLib.includes('^[0-9a-f]{48}$') || parentLib.includes('/^[0-9a-f]{48}$/'));

console.log('parent-email-invite-test: OK');
