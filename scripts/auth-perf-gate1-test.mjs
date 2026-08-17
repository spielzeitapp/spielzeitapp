/**
 * AUTH-PERF.GATE-1 — InternalLayout gate cache per user session.
 * Run: node scripts/auth-perf-gate1-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const childLink = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
const invites = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');

assert.ok(layout.includes('gatePassedUserIdRef'), 'cache ref bound to session');
assert.ok(layout.includes('gatePassedUserId'), 'cache state for render');
assert.ok(layout.includes('isAppShellTabPath'), 'shell-tab helper');
assert.ok(layout.includes("'/app/home'"), 'home tab');
assert.ok(layout.includes("'/app/termine'"), 'termine tab');
assert.ok(layout.includes("'/app/team'"), 'team tab');
assert.ok(layout.includes("'/app/live'"), 'live tab');
assert.ok(layout.includes("'/app/mehr'"), 'mehr tab');

assert.ok(layout.includes('allowAppShell'), 'mark gate passed for this user');
assert.ok(
  layout.includes('gatePassedUserIdRef.current === userId && isAppShellTabPath'),
  'warm shell tabs skip gate',
);
assert.ok(
  layout.includes('gatePassedUserIdRef.current !== userId'),
  'cache reset on user switch',
);
assert.ok(layout.includes('if (!userId)'), 'cache reset on logout');

const skipIdx = layout.indexOf('Warm tab switch');
const guardianIdx = layout.indexOf('userHasPlayerGuardian', skipIdx);
const inviteIdx = layout.indexOf('hasOpenParentEmailInviteForMe');
const getUserIdx = layout.indexOf("supabase.auth.getUser()");
assert.ok(skipIdx > 0 && skipIdx < guardianIdx, 'skip runs before guardian RPC');
assert.ok(layout.slice(skipIdx, skipIdx + 500).includes('setGateChecking(false)'), 'warm skip does not set checking true');
assert.ok(!layout.slice(skipIdx, skipIdx + 500).includes('setGateChecking(true)'), 'warm skip never setGateChecking(true)');

assert.ok(layout.includes('!gatePassedForUser'), 'no Lade… after gate passed');
assert.ok(layout.includes('sessionLoading || gateChecking'), 'first visit still waits');

assert.ok(layout.includes('skipPendingInvite'), 'pending-invite guardian skip kept');
assert.ok(layout.includes('hasOpenParentEmailInviteForMe'), 'open invite still detected on first gate');
assert.ok(layout.includes("navigate('/app/parent-onboarding'"), 'unlinked parent redirect kept');
assert.ok(layout.includes("window.location.replace('/app/parent-invite')"), 'open invite redirect kept');
assert.ok(layout.includes('hasGuardian'), 'linked parent allow path kept');

assert.ok(!layout.includes('from(\'memberships\')'), 'layout does not write memberships');
assert.ok(!layout.includes('redeem_parent_link_invite'), 'layout does not redeem');
assert.ok(childLink.includes('redeem_parent_link_invite'), 'redeem RPC client unchanged');
assert.ok(accept.includes('redeemSuccessRef'), 'race latch unchanged');
assert.ok(accept.includes('Zur Anmeldung'), 'already_used login unchanged');
assert.ok(invites.includes('peek_parent_link_invite'), 'peek RPC unchanged');

console.log('auth-perf-gate1-test: OK');
