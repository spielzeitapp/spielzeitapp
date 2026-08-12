/**
 * PARENT-INVITE.1F static assertions.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const inviteLib = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/pages/SchedulePage.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/auth/AuthProvider.tsx'), 'utf8');
const session = fs.readFileSync(path.join(root, 'src/auth/useSession.tsx'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'src/lib/accountScopedStorage.ts'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812180000_parent_invite_email_bound_recovery.sql'),
  'utf8',
);

assert.ok(login.includes('resolvePostAuthDestination') || login.includes('hasOpenParentEmailInviteForMe'));
assert.ok(login.includes("window.location.replace") || login.includes('hardReplace'));
assert.ok(login.includes('clearAccountScopedClientState'));
assert.ok(login.includes('resolvePostAuthDestination') || login.indexOf('hasOpenParentEmailInviteForMe') < login.indexOf("navigate(dest"));

assert.ok(accept.includes('previewOpenParentEmailInviteForMe'));
assert.ok(accept.includes('redeemOpenParentEmailInviteForMe'));
assert.ok(accept.includes('Einladung annehmen'));
assert.ok(accept.includes('emailBoundMode'));
assert.ok(accept.indexOf('clearStashedParentInviteToken') > accept.indexOf('redeem'));

assert.ok(inviteLib.includes('has_open_parent_email_invite_for_me'));
assert.ok(inviteLib.includes('markPendingParentEmailInvite'));

assert.ok(layout.includes('hasOpenParentEmailInviteForMe'));
assert.ok(layout.includes("window.location.replace('/app/parent-invite')"));

assert.ok(schedule.includes('user ? null : publicTeamId'));
assert.ok(auth.includes('clearAccountScopedClientState'));
assert.ok(session.includes('clearAccountScopedClientState'));
assert.ok(storage.includes('spielzeit_team_season_id'));

assert.ok(migration.includes('has_open_parent_email_invite_for_me'));
assert.ok(migration.includes('preview_open_parent_email_invite_for_me'));
assert.ok(migration.includes('redeem_open_parent_email_invite_for_me'));

console.log('parent-invite1f-flow-test: OK');
