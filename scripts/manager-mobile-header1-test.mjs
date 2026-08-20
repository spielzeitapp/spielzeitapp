/**
 * MANAGER-MOBILE-HEADER.1 – Safe-Area, Menü-Touchziel, Zur SpielzeitApp
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const header = read('src/manager/components/ManagerHeader.tsx');
const sidebar = read('src/manager/components/ManagerSidebar.tsx');

assert.ok(header.includes('pt-[env(safe-area-inset-top)]'), 'header safe-area-inset-top missing');
assert.ok(header.includes('Zur App'), 'header Zur App label missing');
assert.ok(header.includes('aria-label="Zur SpielzeitApp"'), 'header aria-label missing');
assert.ok(header.includes('MANAGER_TO_APP_HOME_PATH') || header.includes('/app/home'), 'header app route missing');
assert.ok(header.includes('title="Abmelden"'), 'logout must stay');
assert.ok(header.includes('LogOut'), 'logout icon must stay');
assert.ok(!/onClick=\{.*onLogout.*\}[\s\S]*Zur App/.test(header.replace(/\n/g, ' ')), 'logout must not be app switch');

assert.ok(sidebar.includes('min-h-[44px]') && sidebar.includes('min-w-[44px]'), 'menu button 44px missing');
assert.ok(sidebar.includes('Zur SpielzeitApp'), 'sidebar Zur SpielzeitApp missing');
assert.ok(sidebar.includes("MANAGER_TO_APP_HOME_PATH = '/app/home'") || sidebar.includes("'/app/home'"), 'app home path missing');
assert.ok(sidebar.includes('lg:hidden') && sidebar.includes('Zur SpielzeitApp'), 'mobile top app link missing');
assert.ok(sidebar.includes('pt-[env(safe-area-inset-top)]'), 'sidebar drawer safe-area missing');

console.log('manager-mobile-header1-test: OK');
