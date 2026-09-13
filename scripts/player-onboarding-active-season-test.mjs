import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/PlayerOnboardingPage.tsx', import.meta.url), 'utf8');
const playerLogin = readFileSync(
  new URL('../src/components/auth/PlayerLoginPanel.tsx', import.meta.url),
  'utf8',
);
const qrRedeem = readFileSync(
  new URL('../src/pages/PlayerAccessRedeemPage.tsx', import.meta.url),
  'utf8',
);
const accessSeasonMigration = readFileSync(
  new URL('../supabase/migrations/20260913103000_player_access_active_season.sql', import.meta.url),
  'utf8',
);

assert.match(source, /\.eq\('status', 'active'\)/, 'player onboarding must require an active season');
assert.match(source, /\.is\('archived_at', null\)/, 'player onboarding must exclude archived seasons');
assert.match(source, /listRoster\(String\(row\.id\), 'active'\)/, 'only seasons with an active roster may be offered');
assert.match(source, /roster\.data\.length > 0/, 'empty internal test teams must not be offered');
assert.match(source, /seasonNameById/, 'the current season must be visible in the team label');

for (const [label, loginSource] of [
  ['code/PIN login', playerLogin],
  ['QR activation', qrRedeem],
]) {
  assert.match(loginSource, /useState\(true\)/, `${label}: remember-me must default to enabled`);
  assert.match(
    loginSource,
    /Auf diesem Gerät angemeldet bleiben/,
    `${label}: remember-me control is missing`,
  );
  assert.match(
    loginSource,
    /setRememberMePreference\(rememberMe\)/,
    `${label}: remember-me preference is not applied before sign-in`,
  );
}

assert.match(
  accessSeasonMigration,
  /resolve_player_access_team_season/,
  'player access must resolve the active roster season',
);
assert.match(
  accessSeasonMigration,
  /trg_player_login_credentials_active_season/,
  'future code/PIN credentials must follow the active season',
);
assert.match(
  accessSeasonMigration,
  /trg_player_access_invites_active_season/,
  'future QR invites must follow the active season',
);
assert.match(
  accessSeasonMigration,
  /INSERT INTO public\.memberships/,
  'existing player devices must receive their active-season membership',
);

console.log('player onboarding active-season checks passed');
