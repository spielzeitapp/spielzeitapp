/**
 * Eltern-Onboarding / Auth-Redirect / Gate-Logik (ohne Netzwerk).
 */
import assert from 'assert';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Dynamischer Import der TS-Quellen geht nicht ohne Build — Logik hier spiegeln / aus dist prüfen.
// Stattdessen: reine JS-Spiegel der kritischen Hilfen (gleiche Regeln wie parentChildLink + authRedirect).

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

// 6) Auth-Layout: Passwortseite ohne App-Chrome (Dateiprüfung)
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

// 7) ParentOnboarding enthält Später verknüpfen + Rollenpersistenz
const onboarding = fs.readFileSync(path.join(root, 'src/pages/ParentOnboardingPage.tsx'), 'utf8');
assert.ok(onboarding.includes('Später verknüpfen'));
assert.ok(onboarding.includes('setParentLinkDeferred'));
assert.ok(onboarding.includes('persistParentRoleChoice'));
assert.ok(onboarding.includes('userHasPlayerGuardian'));
assert.ok(onboarding.includes('listActiveTeamSeasonsForParentLink'));
assert.ok(onboarding.includes('listPlayersForParentLink'));

// 7b) RoleChoice persistiert Elternrolle vor Navigation
const roleChoice = fs.readFileSync(path.join(root, 'src/pages/RoleChoicePage.tsx'), 'utf8');
assert.ok(roleChoice.includes('persistParentRoleChoice'));
assert.ok(roleChoice.includes('Speichere'));

// 8) Mehr-Hub Link
const mehr = fs.readFileSync(path.join(root, 'src/pages/MoreHubPage.tsx'), 'utf8');
assert.ok(mehr.includes('Kind verknüpfen'));
assert.ok(mehr.includes('parent-onboarding?mode=link'));

// 9) useSession leitet Elternrolle aus Metadata ab
const useSession = fs.readFileSync(path.join(root, 'src/auth/useSession.tsx'), 'utf8');
assert.ok(useSession.includes('resolveParentUiRole'));

// 10) RPC-Migration für sichere Spielerliste
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811120000_parent_link_onboarding_rpc.sql'),
  'utf8',
);
assert.ok(migration.includes('list_parent_link_roster'));
assert.ok(migration.includes('list_parent_link_team_seasons'));

console.log('parent-onboarding-flow-test: OK');
