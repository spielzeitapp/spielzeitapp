/**
 * PARENT-INVITE.FINAL-STAGING — static regression + Test B assertions.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const login = read('src/pages/LoginPage.tsx');
const register = read('src/pages/RegisterPage.tsx');
const postAuth = read('src/lib/postAuthDestination.ts');
const introEntry = read('src/app/intro/IntroEntryRedirect.tsx');
const introFlow = read('src/app/intro/introFlowSession.ts');
const welcome = read('src/app/intro/WelcomeScreen.tsx');
const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const layout = read('src/app/layout/InternalLayout.tsx');
const profile = read('src/components/team/PlayerProfileModal.tsx');
const hint = read('src/components/team/TrainerParentAccessHint.tsx');
const parentsTab = read('src/components/team/TeamParentsTab.tsx');
const guardians = read('src/components/team/PlayerGuardiansPanel.tsx');
const schedule = read('src/pages/SchedulePage.tsx');
const authProv = read('src/auth/AuthProvider.tsx');

// --- Auth entry priority ---
assert.ok(postAuth.includes("kind: 'parent_invite'"));
assert.ok(postAuth.includes("kind: 'deep_link'"));
assert.ok(postAuth.includes("kind: 'branded_entry'"));
assert.ok(postAuth.includes('INTRO_SPLASH_PATH'));
assert.ok(postAuth.includes('POST_AUTH_HOME_PATH'));
assert.ok(postAuth.includes('clearIntroFlowCompleted'));
assert.ok(postAuth.indexOf('resolvePendingParentInvitePath') < postAuth.indexOf('isInternalAppDeepLink'));

assert.ok(login.includes('resolvePostAuthDestination'));
assert.ok(
  login.includes('consciousLogin: true') ||
    login.includes('consciousLogin: !isParentInviteFlow') ||
    login.includes('consciousLogin: false'),
);
assert.ok(!login.includes("'/app/termine'"));
assert.ok(!login.includes('"/app/termine"'));

assert.ok(introEntry.includes('POST_AUTH_HOME_PATH'));
assert.ok(!introEntry.includes('/app/termine'));
assert.ok(introFlow.includes('clearIntroFlowCompleted'));
assert.ok(welcome.includes('/app/home') || welcome.includes('ROUTE_APP_HOME'));
assert.ok(welcome.includes('resolvePendingParentInvitePath'));

// --- Invite wins ---
assert.ok(layout.includes('hasOpenParentEmailInviteForMe'));
assert.ok(layout.includes("window.location.replace('/app/parent-invite')"));
assert.ok(accept.includes('previewOpenParentEmailInviteForMe') || accept.includes('previewParentLinkInvite'));
assert.ok(accept.includes('Einladung annehmen'));
assert.ok(accept.includes('Saison '));
assert.ok(accept.includes('Mit der Annahme wirst du'));
assert.ok(accept.indexOf('clearStashedParentInviteToken') > accept.indexOf('redeem'));

// --- Test B: new parent account ---
assert.ok(register.includes('isParentInviteFlow'));
assert.ok(register.includes('eingeladene E-Mail-Adresse'));
assert.ok(register.includes('inviteEmailLocked') || register.includes('readOnly={inviteEmailLocked}'));
assert.ok(register.includes('stashParentInviteEmail'));
assert.ok(register.includes('resolvePostAuthDestination'));
assert.ok(register.includes('direkt mit der Einladung weiter'));
assert.ok(register.includes('ohne Rollen- oder Mannschaftswahl'));

// --- Account isolation ---
assert.ok(schedule.includes('user ? null : publicTeamId'));
assert.ok(authProv.includes('clearAccountScopedClientState'));
assert.ok(authProv.includes('clearIntroFlowCompleted'));

// --- Trainer UI cleanup ---
assert.ok(profile.includes('TrainerParentAccessHint'));
assert.ok(!profile.includes('PlayerGuardiansPanel'));
assert.ok(hint.includes('Zugänge verwalten'));
assert.ok(hint.includes('/app/mehr/parent-access?player='));
assert.ok(parentsTab.includes('Fehlt'));
assert.ok(parentsTab.includes('Offen'));
assert.ok(parentsTab.includes('Verknüpft'));
assert.ok(parentsTab.includes('focusPlayerId'));
assert.ok(parentsTab.includes('listParentLinkInvitesForPlayer'));
assert.ok(guardians.includes('72 Stunden') || guardians.includes('72 Stunden gültig'));
assert.ok(guardians.includes('inviteBusy'));

console.log('parent-invite-final-staging-test: OK');
