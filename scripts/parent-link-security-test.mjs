/**
 * Statische Sicherheitschecks für Eltern-Einladung vs. Spielerzugang.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811160000_secure_parent_link_invites.sql'),
  'utf8',
);
const playerLogin = fs.readFileSync(path.join(root, 'src/components/auth/PlayerLoginPanel.tsx'), 'utf8');
const playerAccess = fs.readFileSync(path.join(root, 'src/components/player/PlayerAccessQrPanel.tsx'), 'utf8');
const parentOnboarding = fs.readFileSync(path.join(root, 'src/pages/ParentOnboardingPage.tsx'), 'utf8');
const parentLib = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');

assert.ok(mig.includes('create_parent_link_invite'));
assert.ok(mig.includes('redeem_parent_link_invite'));
assert.ok(mig.includes('revoke_parent_link_invite'));
assert.ok(mig.includes('list_parent_link_invites_for_player'));
assert.ok(mig.includes('list_my_linked_children'));
assert.ok(mig.includes('can_manage_team_staff'));
assert.ok(mig.includes('player_on_team_season_roster'));
assert.ok(mig.includes("encode(extensions.gen_random_bytes(24), 'hex')"));
assert.ok(mig.includes("encode(extensions.digest("));
assert.ok(mig.includes('FOR UPDATE'));
assert.ok(mig.includes('^[0-9a-f]{48}$'));
assert.ok(mig.includes('DROP POLICY IF EXISTS player_guardians_insert_own'));
assert.ok(mig.includes('DROP POLICY IF EXISTS player_guardians_insert_authenticated'));
assert.ok(mig.includes('DROP POLICY IF EXISTS "allow insert player_guardians"'));
assert.ok(mig.includes('parent_link_roster_listing_disabled'));
assert.ok(mig.includes('SET search_path = public'));
assert.ok(mig.includes('SECURITY DEFINER'));
assert.ok(!/GRANT EXECUTE[\s\S]*list_parent_link_roster[\s\S]*TO authenticated/.test(mig));

const selfServiceMig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812120000_parent_self_service_onboarding.sql'),
  'utf8',
);
assert.ok(selfServiceMig.includes('list_parent_onboarding_roster'));
assert.ok(selfServiceMig.includes('link_parent_self_service'));
assert.ok(!selfServiceMig.includes('GRANT INSERT ON public.player_guardians'));

// Trennung: Eltern-Einladung ≠ Spieler-Login
assert.ok(playerLogin.includes('player_code_login'));
assert.ok(!playerLogin.includes('redeem_parent_link_invite'));
assert.ok(playerAccess.includes('generate_player_login_credentials') || playerAccess.includes('PlayerAccess'));
assert.ok(!parentOnboarding.includes('player_code_login'));
assert.ok(parentLib.includes("isParentInviteTokenShape"));
assert.ok(parentLib.includes('48'));

console.log('parent-link-security-test: OK');
