/**
 * PARENT-LINK.2: role-cast fix + save-path expectations (static).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812140000_fix_parent_link_role_cast.sql'),
  'utf8',
);
assert.ok(mig.includes('link_parent_self_service'));
assert.ok(mig.includes('redeem_parent_link_invite'));
assert.ok(mig.includes('m.role::text'));
assert.ok(mig.includes('role::text'));
assert.ok(mig.includes('already_linked'));
assert.ok(mig.includes('ON CONFLICT (user_id, team_season_id) DO NOTHING'));
assert.ok(mig.includes('INSERT INTO public.profiles'));
assert.ok(mig.includes('WHEN OTHERS THEN'));
assert.ok(mig.includes('lower(trim(m.role::text))'));
assert.ok(mig.includes('lower(trim(role::text))'));
// Comment may mention the old bug pattern; executable SQL must cast
const executable = mig
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');
assert.ok(!/\btrim\(m\.role\)\s/.test(executable));
assert.ok(!/\btrim\(role\)\s+NOT IN/.test(executable));

const parentLib = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
assert.ok(parentLib.includes('linkParentSelfService'));
assert.ok(parentLib.includes('link_parent_self_service'));
assert.ok(parentLib.includes("'linked'"));
assert.ok(parentLib.includes('clearParentLinkDeferred'));

const onboarding = fs.readFileSync(path.join(root, 'src/pages/ParentOnboardingPage.tsx'), 'utf8');
assert.ok(onboarding.includes('linkParentSelfService'));
assert.ok(onboarding.includes('Wird gespeichert'));
assert.ok(onboarding.includes('Kind erfolgreich verknüpft'));
assert.ok(onboarding.includes('location.assign'));
assert.ok(onboarding.includes('handleSave'));
assert.ok(onboarding.includes('setParentLinkDeferred'));
assert.ok(onboarding.includes('clearParentLinkDeferred'));
assert.ok(onboarding.includes('saving || deferring'));

const home = fs.readFileSync(path.join(root, 'src/features/home/HomePage.tsx'), 'utf8');
assert.ok(home.includes('Noch kein Kind verknüpft'));
assert.ok(home.includes('Jetzt Kind verknüpfen'));
assert.ok(home.includes('parent-onboarding?mode=link'));

const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');
assert.ok(layout.includes('userHasPlayerGuardian'));
assert.ok(layout.includes('isParentLinkDeferred'));

// Historical buggy migration still has uncased trim (audit trail)
const old = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812120000_parent_self_service_onboarding.sql'),
  'utf8',
);
assert.ok(old.includes('trim(m.role)'));

console.log('parent-link2-save-test: OK');
