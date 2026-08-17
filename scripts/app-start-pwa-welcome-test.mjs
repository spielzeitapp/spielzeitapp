/**
 * APP-START.PERFORMANCE-AND-PWA — Welcome + PWA config.
 * Run: node scripts/app-start-pwa-welcome-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const welcome = fs.readFileSync(path.join(root, 'src/app/intro/WelcomeScreen.tsx'), 'utf8');
const pwa = fs.readFileSync(path.join(root, 'src/lib/pwaDisplayMode.ts'), 'utf8');
const requireAuth = fs.readFileSync(path.join(root, 'src/auth/RequireAuth.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const trainerManifest = JSON.parse(
  fs.readFileSync(path.join(root, 'public/manifest-trainer.json'), 'utf8'),
);
const publicManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));

assert.ok(welcome.includes('Zur App'), 'Safari/PWA CTA label');
assert.ok(welcome.includes('PremiumIntroButton onClick={goHome}'), 'Zur App always wired');
assert.ok(!welcome.includes('requestAnimationFrame'), 'CTA not gated on rAF');
assert.ok(!welcome.includes('opacity-0'), 'no invisible CTA layer');
assert.ok(welcome.includes('pointer-events-auto'), 'CTA stack receives taps');
assert.ok(welcome.includes('touch-manipulation'), 'iOS tap delay avoided');
assert.ok(welcome.includes('grid-rows-[minmax(10rem,1fr)_auto_auto]'), 'hero 1fr, CTAs bottom');
assert.ok(!welcome.includes('58vh'), 'no fixed 58vh spacer');
assert.ok(welcome.includes('min-h-[100dvh]'), 'full viewport column');
assert.ok(welcome.includes('isStandaloneDisplayMode'), 'standalone vs Safari');
assert.ok(welcome.includes('Teilen → Zum Home-Bildschirm'), 'iOS install copy');
assert.ok(welcome.includes('App-Modus aktiv'), 'standalone does not fake install');
assert.ok(welcome.includes("navigate(ROUTE_APP_HOME, { replace: true })"), 'session path → /app/home');
assert.ok(welcome.includes('resolvePendingParentInvitePath'), 'pending invite still wins');

assert.ok(pwa.includes('navigator.standalone'), 'iOS navigator.standalone');
assert.ok(pwa.includes('display-mode: standalone'), 'display-mode media query');

assert.ok(requireAuth.includes('if (!user)'), 'no session → login');
assert.ok(requireAuth.includes('to="/login"'), 'RequireAuth login target');
assert.ok(app.includes('<RequireAuth><IntroAppOutlet /></RequireAuth>'), 'Welcome sits behind auth');
assert.ok(app.includes('path="intro/welcome" element={<WelcomeScreen />}'), 'Welcome route');

assert.ok(indexHtml.includes('rel="manifest"'), 'static manifest link');
assert.ok(indexHtml.includes('href="/manifest-trainer.json"'), 'trainer manifest on app host');
assert.ok(indexHtml.includes('apple-mobile-web-app-capable'), 'iOS standalone meta');
assert.ok(indexHtml.includes('apple-mobile-web-app-title'), 'iOS title');
assert.ok(indexHtml.includes('apple-mobile-web-app-status-bar-style'), 'iOS status bar');
assert.ok(appHtml.includes('apple-mobile-web-app-capable'), 'app.html iOS capable');

assert.equal(trainerManifest.start_url, '/app', 'PWA start URL');
assert.equal(trainerManifest.scope, '/', 'login stays inside PWA scope');
assert.equal(trainerManifest.display, 'standalone', 'standalone display');
assert.equal(publicManifest.display, 'standalone', 'public manifest display');

console.log('app-start-pwa-welcome-test: OK');
