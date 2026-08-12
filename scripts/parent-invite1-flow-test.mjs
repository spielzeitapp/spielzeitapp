/**
 * PARENT-INVITE.1 flow assertions (static).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const inviteLib = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const redeemFix = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812140000_fix_parent_link_role_cast.sql'),
  'utf8',
);

// Token survives auth via next=?t= and localStorage TTL stash
assert.ok(inviteLib.includes('buildParentInviteAuthNext'));
assert.ok(inviteLib.includes('PARENT_INVITE_STASH_TTL_MS') || inviteLib.includes('72 * 60'));
assert.ok(accept.includes('authQuery'));
assert.ok(accept.includes('`/register?${authQuery}`') || accept.includes('/register?${authQuery}'));

// No child data before auth / email match
assert.ok(accept.includes('Kinddaten'));
assert.ok(accept.includes('erst nach erfolgreicher Anmeldung'));
assert.ok(accept.includes("playerDisplayName: null"));

// Wrong email blocked
assert.ok(accept.includes('email_mismatch'));
assert.ok(register.includes('eingeladene E-Mail-Adresse'));
assert.ok(login.includes('eingeladene E-Mail-Adresse'));
assert.ok(login.includes('window.location.replace') || login.includes('resolvePostAuthDestination'));
assert.ok(login.includes('readParentInviteTokenFromUserMetadata') || login.includes('resolvePostAuthDestination'));
assert.ok(login.includes('hasOpenParentEmailInviteForMe') || login.includes('resolvePostAuthDestination'));
assert.ok(accept.includes('authLoading'));
assert.ok(accept.includes('useParams'));
assert.ok(accept.includes('clearParentInviteTokenFromUserMetadata'));
assert.ok(inviteLib.includes('resolvePendingParentInvitePath'));
assert.ok(
  accept.indexOf('await persistParentRoleChoice()') >
    accept.indexOf('await redeemParentLinkInvite(token)'),
);

const parentOnboarding = fs.readFileSync(
  path.join(root, 'src/pages/ParentOnboardingPage.tsx'),
  'utf8',
);
assert.ok(parentOnboarding.includes('resolvePendingParentInvitePath'));

const roleChoice = fs.readFileSync(path.join(root, 'src/pages/RoleChoicePage.tsx'), 'utf8');
assert.ok(roleChoice.includes('resolvePendingParentInvitePath'));

// Idempotent accept + home with season
assert.ok(accept.includes('already_linked'));
assert.ok(accept.includes('clearParentLinkDeferred'));
assert.ok(accept.includes('spielzeit_team_season_id'));
assert.ok(accept.includes('/app/home'));

// Enum cast fix still present for redeem
assert.ok(redeemFix.includes('role::text'));
assert.ok(redeemFix.includes('redeem_parent_link_invite'));

console.log('parent-invite1-flow-test: OK');
