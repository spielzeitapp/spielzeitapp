/**
 * Eltern-Onboarding / Auth-Redirect / Gate-Logik + sichere Verknüpfung (ohne Netzwerk).
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function isSafeAuthRedirectPath(p) {
  if (!p || typeof p !== 'string') return false;
  const trimmed = p.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (trimmed.includes('\\') || trimmed.includes('@')) return false;
  const allowed = ['/', '/app', '/login', '/register', '/forgot-password'];
  return allowed.some((x) => trimmed === x || trimmed.startsWith(`${x}/`) || (x === '/app' && trimmed.startsWith('/app')));
}

function getAuthRedirectUrl(origin, pathIn = '/') {
  const normalizedPath = pathIn.startsWith('/') ? pathIn : `/${pathIn}`;
  const safePath = isSafeAuthRedirectPath(normalizedPath) ? normalizedPath : '/app';
  if (!origin) return safePath;
  return `${origin.replace(/\/$/, '')}${safePath}`;
}

function isParentOnboardingSatisfied(opts) {
  if (opts.hasGuardian) return { complete: true, needsOnboardingUi: false };
  if (opts.deferred) return { complete: true, needsOnboardingUi: false };
  const looksLikeParent =
    opts.previewIsParent ||
    opts.backendIsParent ||
    opts.hasParentMembership ||
    opts.parentRoleChosen === true;
  if (looksLikeParent) return { complete: false, needsOnboardingUi: true };
  return { complete: true, needsOnboardingUi: false };
}

function resolveParentUiRole(meta) {
  if (!meta) return null;
  if (meta.parent_role_chosen === true || meta.parent_link_deferred === true) return 'parent';
  return null;
}

function normalizeTeamSeasonStatus(status) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'draft' || s === 'archived') return s;
  return 'active';
}

function filterActiveSeasons(rows) {
  return rows.filter((r) => {
    const st = normalizeTeamSeasonStatus(r.status);
    return st === 'active';
  });
}

function formatLabel(row) {
  if (row.display_name) return row.display_name;
  const age = row.age_group || '';
  const team = row.team_name || 'Team';
  return age ? `${age} ${team}`.trim() : team;
}

function normalizeParentInviteToken(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isParentInviteTokenShape(token) {
  return /^[0-9a-f]{48}$/.test(token);
}

// 1) Guardian vorhanden → kein Onboarding-UI
assert.deepStrictEqual(
  isParentOnboardingSatisfied({
    hasGuardian: true,
    hasParentMembership: false,
    deferred: false,
    previewIsParent: true,
    backendIsParent: false,
  }),
  { complete: true, needsOnboardingUi: false },
);

// 2) Deferred ohne Guardian → App ok, kein Pflicht-Onboarding
assert.deepStrictEqual(
  isParentOnboardingSatisfied({
    hasGuardian: false,
    hasParentMembership: false,
    deferred: true,
    previewIsParent: true,
    backendIsParent: false,
  }),
  { complete: true, needsOnboardingUi: false },
);

// 3) Parent ohne Guardian/Defer → Onboarding nötig
assert.deepStrictEqual(
  isParentOnboardingSatisfied({
    hasGuardian: false,
    hasParentMembership: true,
    deferred: false,
    previewIsParent: false,
    backendIsParent: false,
  }),
  { complete: false, needsOnboardingUi: true },
);

// 3b) parent_role_chosen ohne Guardian → Onboarding nötig
assert.deepStrictEqual(
  isParentOnboardingSatisfied({
    hasGuardian: false,
    hasParentMembership: false,
    deferred: false,
    previewIsParent: false,
    backendIsParent: false,
    parentRoleChosen: true,
  }),
  { complete: false, needsOnboardingUi: true },
);

// 3c) deferred ohne Rolle → Self-Healing UI-Rolle parent
assert.strictEqual(
  resolveParentUiRole({ parent_link_deferred: true, parent_role_chosen: false }),
  'parent',
);

// 3d) parent_role_chosen → UI-Rolle parent
assert.strictEqual(resolveParentUiRole({ parent_role_chosen: true }), 'parent');
assert.strictEqual(resolveParentUiRole({}), null);

// 4) Aktive U12, archivierte U11 ausfiltern
const seasons = [
  { id: 'a', status: 'archived', display_name: 'U11 SPG Rohrbach · 2025/26', team_name: 'U11 SPG Rohrbach' },
  { id: 'b', status: 'active', display_name: 'U12 SPG Rohrbach · 2026/27', team_name: 'U11 SPG Rohrbach', age_group: 'U12' },
];
const active = filterActiveSeasons(seasons);
assert.strictEqual(active.length, 1);
assert.strictEqual(active[0].id, 'b');
assert.ok(formatLabel(active[0]).includes('U12'));
assert.ok(!active.some((s) => s.status === 'archived'));

// 5) Redirect Staging, nicht localhost erzwingen; externe Ziele abweisen
assert.strictEqual(
  getAuthRedirectUrl('https://app.spielzeitapp.at', '/app/set-password'),
  'https://app.spielzeitapp.at/app/set-password',
);
assert.strictEqual(isSafeAuthRedirectPath('https://evil.example/phish'), false);
assert.strictEqual(isSafeAuthRedirectPath('//evil.example'), false);
assert.strictEqual(isSafeAuthRedirectPath('/app/set-password'), true);
assert.ok(!getAuthRedirectUrl('https://app.spielzeitapp.at', 'https://evil.com').includes('evil.com'));

const fs = await import('fs');
const appTsx = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
assert.ok(appTsx.includes('AuthMinimalLayout'));
assert.ok(/AuthMinimalLayout[\s\S]*set-password/.test(appTsx));
const setPwd = fs.readFileSync(path.join(root, 'src/pages/SetPasswordPage.tsx'), 'utf8');
assert.ok(!/BottomNav|Header/.test(setPwd));
const authLayout = fs.readFileSync(path.join(root, 'src/app/layout/AuthMinimalLayout.tsx'), 'utf8');
assert.ok(authLayout.includes('100dvh'));
assert.ok(authLayout.includes('safe-area-inset-bottom'));
assert.ok(!authLayout.includes('BottomNav'));
assert.ok(!authLayout.includes('<Header'));

// 7) ParentOnboarding: Code-Flow, kein offenes Kaderlisting
const onboarding = fs.readFileSync(path.join(root, 'src/pages/ParentOnboardingPage.tsx'), 'utf8');
assert.ok(onboarding.includes('Später verknüpfen'));
assert.ok(onboarding.includes('setParentLinkDeferred'));
assert.ok(onboarding.includes('persistParentRoleChoice'));
assert.ok(onboarding.includes('userHasPlayerGuardian'));
assert.ok(onboarding.includes('redeemParentLinkInvite'));
assert.ok(onboarding.includes('Einladungscode'));
assert.ok(!onboarding.includes('listActiveTeamSeasonsForParentLink'));
assert.ok(!onboarding.includes('listPlayersForParentLink'));
assert.ok(!onboarding.includes('Team auswählen'));
assert.ok(!onboarding.includes("from('player_guardians')\n          .insert"));

// Token-Shape: 48 hex, kein Spieler-Kurzcode
assert.ok(isParentInviteTokenShape(normalizeParentInviteToken('a'.repeat(48))));
assert.ok(!isParentInviteTokenShape('AB12CD'));
assert.ok(!isParentInviteTokenShape('player-login-code'));
assert.ok(!isParentInviteTokenShape('a'.repeat(47)));

// 7b) RoleChoice persistiert Elternrolle vor Navigation
const roleChoice = fs.readFileSync(path.join(root, 'src/pages/RoleChoicePage.tsx'), 'utf8');
assert.ok(roleChoice.includes('persistParentRoleChoice'));
assert.ok(roleChoice.includes('Speichere'));

// 8) Mehr-Hub Link
const mehr = fs.readFileSync(path.join(root, 'src/pages/MoreHubPage.tsx'), 'utf8');
assert.ok(mehr.includes('Kind verknüpfen'));
assert.ok(mehr.includes('Weiteres Kind verknüpfen'));
assert.ok(mehr.includes('parent-onboarding?mode=link'));

// 8b) Eltern-Rollenumschalter im Header
const header = fs.readFileSync(path.join(root, 'src/app/layout/Header.tsx'), 'utf8');
assert.ok(header.includes('ParentChildrenSwitcher'));

// 9) useSession leitet Elternrolle aus Metadata ab
const useSession = fs.readFileSync(path.join(root, 'src/auth/useSession.tsx'), 'utf8');
assert.ok(useSession.includes('resolveParentUiRole'));

// 10) Historische List-RPC-Migration bleibt (bereits angewendet), Folgemigration sperrt
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811120000_parent_link_onboarding_rpc.sql'),
  'utf8',
);
assert.ok(migration.includes('list_parent_link_roster'));
assert.ok(migration.includes('list_parent_link_team_seasons'));

const secureMig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811160000_secure_parent_link_invites.sql'),
  'utf8',
);
assert.ok(secureMig.includes('parent_link_roster_listing_disabled'));
assert.ok(secureMig.includes('create_parent_link_invite'));
assert.ok(secureMig.includes('redeem_parent_link_invite'));
assert.ok(secureMig.includes('REVOKE ALL ON FUNCTION public.list_parent_link_roster'));
assert.ok(secureMig.includes('DROP POLICY IF EXISTS player_guardians_insert_own'));
assert.ok(secureMig.includes('parent_link_invites'));
assert.ok(secureMig.includes('CREATE TABLE IF NOT EXISTS public.parent_link_invites'));
assert.ok(!secureMig.includes('INSERT INTO public.player_access_invites'));
assert.ok(secureMig.includes("GRANT EXECUTE ON FUNCTION public.redeem_parent_link_invite(text) TO authenticated"));
assert.ok(secureMig.includes('REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM anon'));

// 11) Trainer-UI: Eltern einladen getrennt von Spielerzugang
const panel = fs.readFileSync(path.join(root, 'src/components/team/PlayerGuardiansPanel.tsx'), 'utf8');
assert.ok(panel.includes('Eltern einladen'));
assert.ok(panel.includes('createParentLinkInvite'));
assert.ok(panel.includes('Einladung per E-Mail senden'));
assert.ok(panel.includes('Verknüpfung aufheben'));

// 12) Client-Lib ohne Self-Claim-Insert
const parentLib = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
assert.ok(parentLib.includes('redeemParentLinkInvite'));
assert.ok(!parentLib.includes('list_parent_link_roster'));
assert.ok(!parentLib.includes('.insert({'));

console.log('parent-onboarding-flow-test: OK');
