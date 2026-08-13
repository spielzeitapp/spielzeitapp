/**
 * PARENT-ACCESS.CLEANUP + INVITE-FLOW.FINAL — static regression tests.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const sendInvite = read('api/parent/send-invite.js');
const mailLib = read('api/_lib/sendParentInviteEmail.js');
const login = read('src/pages/LoginPage.tsx');
const register = read('src/pages/RegisterPage.tsx');
const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const parentsTab = read('src/components/team/TeamParentsTab.tsx');
const guardians = read('src/components/team/PlayerGuardiansPanel.tsx');
const rosterRow = read('src/components/team/ParentAccessPlayerRow.tsx');
const detailPage = read('src/pages/ParentAccessPlayerPage.tsx');
const app = read('src/app/App.tsx');
const postAuth = read('src/lib/postAuthDestination.ts');
const peekMig = read('supabase/migrations/20260812210000_parent_invite_peek_account_exists.sql');

// --- Invite send: prefer direct mail, no stub when mailer works ---
assert.ok(sendInvite.includes('sendParentInviteEmail'));
assert.ok(sendInvite.includes('auth_stub_created'));
assert.ok(sendInvite.includes('directMail'));
assert.ok(mailLib.includes('RESEND_API_KEY') || mailLib.includes('api.resend.com'));
assert.ok(mailLib.includes('/app/parent-invite/') || mailLib.includes('acceptUrl'));
assert.ok(mailLib.includes('Einladung öffnen'));
// OTP create_user only when auth row missing (fallback)
assert.ok(sendInvite.includes('const createUser = !authExists'));
assert.ok(!/create_user:\s*true/.test(sendInvite));

// --- account_exists = password only ---
assert.ok(peekMig.includes('encrypted_password'));
assert.ok(peekMig.includes('account_exists'));
assert.ok(peekMig.includes('parent_invite_auth_email_status'));

// --- Confirm / login preserve invite ---
assert.ok(sendInvite.includes('invite_confirmed'));
assert.ok(login.includes('invite_confirmed') || login.includes('inviteConfirmedFlag'));
assert.ok(login.includes('lockedInviteEmail') || login.includes('inviteEmailLocked'));
assert.ok(register.includes('complete_signup'));
assert.ok(register.includes('persönliche Einladung annehmen'));
assert.ok(register.includes('ohne Rollen- oder Mannschaftswahl'));
assert.ok(accept.includes('Einladung annehmen'));
assert.ok(postAuth.includes("kind: 'parent_invite'"));

// --- Normal login untouched markers ---
assert.ok(postAuth.includes('INTRO_SPLASH_PATH') || postAuth.includes('splash'));
assert.ok(postAuth.includes('consciousLogin') || login.includes('consciousLogin'));

// --- UI roster ---
assert.ok(parentsTab.includes('ParentAccessPlayerRow'));
assert.ok(parentsTab.includes('parent-access/player/'));
assert.ok(parentsTab.includes('Eltern fehlen') || parentsTab.includes("filter === 'missing'"));
assert.ok(parentsTab.includes('Spieler-App fehlt') || parentsTab.includes('app_missing'));
assert.ok(!parentsTab.includes('PlayerGuardiansPanel'), 'Hauptliste darf kein GuardiansPanel expandieren');
assert.ok(rosterRow.includes('Keine Eltern') || rosterRow.includes('parentStatusLine'));
assert.ok(rosterRow.includes('avatar') || rosterRow.includes('photoUrl') || rosterRow.includes('initials'));
assert.ok(detailPage.includes('PlayerGuardiansPanel'));
assert.ok(detailPage.includes('PlayerAccessQrPanel') || detailPage.includes('Spieler-App'));
assert.ok(detailPage.includes('Verlauf') || guardians.includes('Verlauf anzeigen'));
assert.ok(guardians.includes('Elternteil einladen'));
assert.ok(guardians.includes('Verknüpfung aufheben'));
assert.ok(guardians.includes('•••') || guardians.includes('Aktionen'));
assert.ok(app.includes('ParentAccessPlayerPage'));
assert.ok(app.includes('parent-access/player/:playerId'));

// --- API cap ---
function listApiEndpoints(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '_lib') continue;
      listApiEndpoints(p, acc);
    } else if (/\.(js|ts)$/.test(ent.name) && !ent.name.startsWith('_')) {
      acc.push(path.relative(path.join(root, 'api'), p).replace(/\\/g, '/'));
    }
  }
  return acc;
}
const apiFiles = listApiEndpoints(path.join(root, 'api'));
assert.ok(apiFiles.length <= 12, `API endpoints ≤12, got ${apiFiles.length}`);

console.log('parent-access-cleanup-invite-final-test: OK');
