/**
 * Mehr-Hub: Rollen-Vorschau nur Plattformadmin; Manager-Link ohne Rollenvergabe.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mehr = fs.readFileSync(join(root, 'src/pages/MoreHubPage.tsx'), 'utf8');
const preview = fs.readFileSync(join(root, 'src/pages/TrainerPreviewPage.tsx'), 'utf8');

console.log('mehr-hub platform-admin preview + manager link\n');

assert.ok(mehr.includes('isPlatformAdminBackendRole'), 'MehrHub uses platform-admin backend check');
assert.ok(mehr.includes('showPreviewLink = !isDemo && isPlatformAdminBackendRole(backendRole)'), 'preview gated on backendRole');
assert.ok(!mehr.includes("backendRole === 'admin' || backendRole === 'head_coach'"), 'head_coach no longer opens preview');
assert.ok(mehr.includes('Rollen-Vorschau (nur Plattformadmin)'), 'preview label');
assert.ok(mehr.includes('Ändert nur die Darstellung, nicht deine Berechtigungen.'), 'preview hint');
assert.ok(mehr.includes('canAccessManager'), 'manager access helper');
assert.ok(mehr.includes('Spielzeit Manager öffnen'), 'manager link label');
assert.ok(mehr.includes('to="/manager"'), 'manager href');

assert.ok(preview.includes('isPlatformAdminBackendRole'), 'preview page platform-admin gate');
assert.ok(!preview.includes("backendRole === 'admin' || backendRole === 'head_coach'"), 'preview page no head_coach');
assert.ok(preview.includes('Rollen-Vorschau (nur Plattformadmin)'), 'preview page title');
assert.ok(preview.includes('Ändert nur die Darstellung, nicht deine Berechtigungen.'), 'preview page hint');

console.log('  ✓ Alle Assertions grün');
