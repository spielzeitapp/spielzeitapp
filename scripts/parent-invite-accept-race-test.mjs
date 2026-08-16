/**
 * PARENT-INVITE.ACCEPT-RACE — static assertions for success latch + peek rule.
 * Run: node scripts/parent-invite-accept-race-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const layout = read('src/app/layout/InternalLayout.tsx');
const childLink = read('src/lib/parentChildLink.ts');
const invites = read('src/lib/parentLinkInvites.ts');

// Success latch
assert.ok(accept.includes('redeemSuccessRef'), 'success latch ref');
assert.ok(accept.includes('useRef(false)'), 'useRef latch');
assert.ok(
  /redeemSuccessRef\.current\s*=\s*true/.test(accept),
  'latch set on linked/already_linked',
);

const confirmStart = accept.indexOf('const handleConfirm');
const confirmBody = accept.slice(confirmStart, confirmStart + 2200);
assert.ok(confirmBody.includes("result.status !== 'linked'"), 'checks linked');
assert.ok(confirmBody.includes("result.status !== 'already_linked'"), 'checks already_linked');
assert.ok(
  confirmBody.indexOf('redeemSuccessRef.current = true') <
    confirmBody.indexOf('goHomeWithTeamSeason'),
  'latch before Home navigation',
);
assert.ok(
  confirmBody.indexOf('clearStashedParentInviteToken()') <
    confirmBody.indexOf('goHomeWithTeamSeason'),
  'stash cleared before Home',
);
assert.ok(
  confirmBody.indexOf('clearPendingParentEmailInviteFlag()') <
    confirmBody.indexOf('goHomeWithTeamSeason'),
  'pending flag cleared before Home',
);
assert.ok(confirmBody.includes('persistParentRoleChoice'), 'metadata role cleanup');
assert.ok(confirmBody.includes('clearParentInviteTokenFromUserMetadata'), 'metadata token cleanup');
assert.ok(
  (confirmBody.match(/try\s*\{/g) || []).length >= 3,
  'cleanup errors isolated in try/catch',
);

// Single redeem path (no loop / second redeem in confirm)
const redeemCalls = (confirmBody.match(/redeemParentLinkInvite|redeemOpenParentEmailInviteForMe/g) || [])
  .length;
assert.equal(redeemCalls, 2, 'exactly one token redeem + one email-bound redeem branch');
assert.ok(confirmBody.includes('if (confirming || redeemSuccessRef.current) return'), 'no double submit');

assert.ok(confirmBody.includes('goHomeWithTeamSeason(result.teamSeasonId)'), 'Home with team_season_id');
assert.equal(
  (confirmBody.match(/goHomeWithTeamSeason\(result\.teamSeasonId\)/g) || []).length,
  1,
  'linked navigates Home exactly once in confirm',
);

// Peek only when logged out for terminal status
assert.ok(
  accept.includes('!user && peek.status !== \'ready\' && peek.status !== \'error\''),
  'peek terminal status only when logged out',
);
assert.ok(accept.includes('previewParentLinkInvite(token)'), 'authenticated uses preview');
assert.ok(
  accept.includes('if (!alive || redeemSuccessRef.current) return'),
  'late peek/preview ignored after latch',
);

// already_linked UI still has Zur App
assert.ok(accept.includes("preview?.status === 'already_linked'"), 'already_linked state');
assert.ok(accept.includes('Zur App'), 'Zur App for already_linked');
assert.ok(accept.includes("'already_used'"), 'already_used status handled in UI');
assert.ok(
  childLink.includes('Diese Einladung wurde bereits verwendet.') ||
    invites.includes('Diese Einladung wurde bereits verwendet.'),
  'foreign already_used message preserved in client libs',
);

// InternalLayout: skip pending invite force when guardian
assert.ok(layout.includes('userHasPlayerGuardian'), 'guardian check in layout');
assert.ok(
  layout.includes('guardianRes.hasGuardian') || layout.includes('hasGuardian'),
  'guardian branch',
);
assert.ok(layout.includes('skipPendingInvite'), 'skipPendingInvite flag');
assert.ok(layout.includes('earlyGuardian'), 'early guardian check before pending redirect');
assert.ok(
  layout.includes('skipPendingInvite = earlyGuardian.hasGuardian === true'),
  'guardian gates pending-invite redirect',
);
assert.ok(
  layout.includes('window.location.replace(pendingInvitePath)'),
  'pending path still used when not guardian',
);

// No backend / RPC / membership mutations in this fix surface
assert.ok(childLink.includes('redeem_parent_link_invite'), 'RPC client call unchanged in lib');
assert.ok(!accept.includes('from(\'memberships\')'), 'accept page does not write memberships');
assert.ok(!accept.includes('from("memberships")'), 'accept page does not write memberships');
assert.ok(!accept.includes('player_guardians'), 'accept page does not write guardians');
assert.ok(invites.includes('peek_parent_link_invite'), 'peek RPC client unchanged');

// Safari UX shell preserved
assert.ok(accept.includes('safe-area-inset-top'));
assert.ok(accept.includes('overflow-y-auto'));
assert.ok(accept.includes('min-h-[100dvh]'));

console.log('parent-invite-accept-race-test: OK');
