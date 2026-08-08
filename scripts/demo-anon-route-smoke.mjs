/**
 * Anonymer Smoke-Test: alle zentralen /demo-Routen dürfen nicht auf /login landen.
 * Nutzt Staging-HTML (kein Playwright) — prüft HTTP und Redirect-Kette.
 */
const BASE = process.env.DEMO_BASE_URL || 'https://app.spielzeitapp.at';

const ROUTES = [
  '/demo',
  '/demo/intro/splash',
  '/demo/intro/welcome',
  '/demo/home',
  '/demo/termine',
  '/demo/team',
  '/demo/team?tab=training',
  '/demo/live',
  '/demo/mehr',
  '/demo/events/ev-train-next',
  '/demo/events/ev-game-next',
  '/demo/match-preparation',
  '/demo/match-lineup',
  '/demo/tour/what',
  '/demo/tour/create-training',
  '/demo/tour/parent-training',
  '/demo/tour/create-match',
  '/demo/tour/parent-match',
  '/demo/tour/chronicle',
  '/demo/tour/season',
];

let failed = 0;
for (const path of ROUTES) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { Accept: 'text/html' } });
    const loc = res.headers.get('location') || '';
    const status = res.status;
    const toLogin =
      loc.includes('/login') ||
      (status >= 300 && status < 400 && /login/i.test(loc));
    if (toLogin) {
      console.error('FAIL login-redirect', path, status, loc);
      failed += 1;
    } else if (status >= 400) {
      console.error('FAIL status', path, status);
      failed += 1;
    } else {
      console.log('OK', path, status, loc || '');
    }
  } catch (e) {
    console.error('FAIL fetch', path, e);
    failed += 1;
  }
}

if (failed) {
  console.error(`ANON_DEMO_ROUTES failed: ${failed}`);
  process.exit(1);
}
console.log('ANON_DEMO_ROUTES ok', ROUTES.length);
