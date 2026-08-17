/**
 * APP-START.PERFORMANCE-AND-PWA — Home feed, Gate-1, BottomNav overlays.
 * Run: node scripts/app-start-home-nav-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const feed = fs.readFileSync(path.join(root, 'src/hooks/useTeamFeedPosts.ts'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/features/home/HomePage.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'src/app/components/BottomNav.tsx'), 'utf8');
const push = fs.readFileSync(path.join(root, 'src/components/PushOnboardingPrompt.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const childLink = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
const invites = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');

const loadAllIdx = feed.indexOf('const loadAll');
const loadAllFetch = feed.indexOf('await withTimeout(', loadAllIdx);
const loadAllEnsure = feed.indexOf('await runFeedEnsures', loadAllIdx);
assert.ok(loadAllFetch > 0 && loadAllEnsure > loadAllFetch, 'loadAll fetches before ensures');
assert.ok(feed.includes('setLoading(false)'), 'feed loading can end before ensures');
const ensureBlock = feed.slice(feed.indexOf('if (!skipEnsures)'));
assert.ok(ensureBlock.includes('setEnsuring(true)'), 'ensures marked separately');
assert.ok(ensureBlock.includes('await runFeedEnsures'), 'ensures still run in background');
assert.ok(feed.includes('Promise.all(['), 'ensures run in parallel');
assert.ok(feed.includes('FEED_LOAD_TIMEOUT_MS'), 'feed timeout');
assert.ok(feed.includes('withTimeout('), 'timeout wrapper');
assert.ok(!/setEnsuring\(!skipEnsures\);[\s\S]{0,180}await runFeedEnsures/.test(feed), 'loading flag not tied to serial ensures');

assert.ok(home.includes('Erneut laden'), 'visible retry');
assert.ok(home.includes('teamFeedError'), 'error state rendered');
assert.ok(home.includes('feedBusy = teamFeedLoading && activePosts.length === 0'), 'existing posts show immediately');
assert.ok(
  home.includes('matchSectionReady = !eventsPending && autoMatchdaySettingsReady'),
  'spielplan independent of feed',
);
assert.ok(!home.includes('feedBusy && autoMatchdaySettingsReady'), 'spielplan not gated on feedBusy');
assert.ok(home.includes('{showContent && ('), 'home shell not waiting for events');

assert.ok(layout.includes('gatePassedUserIdRef'), 'Gate-1 cache ref');
assert.ok(layout.includes('gatePassedUserId'), 'Gate-1 cache state');
assert.ok(
  layout.includes('gatePassedUserIdRef.current === userId && isAppShellTabPath'),
  'warm shell tabs skip gate',
);
assert.ok(layout.includes('onExemptPath'), 'tab switches do not retrigger gate');
assert.ok(/onExemptPath,[\r\n]+\s*user,/.test(layout), 'gate deps use exempt-path, not every tab pathname');
assert.ok(layout.includes('userHasPlayerGuardian'), 'first gate still checks guardian');
assert.ok(layout.includes('hasOpenParentEmailInviteForMe'), 'first gate still checks open invite');
assert.ok(!layout.includes("from('memberships')"), 'no membership writes');
assert.ok(!layout.includes('redeem_parent_link_invite'), 'no redeem in layout');
assert.ok(childLink.includes('redeem_parent_link_invite'), 'redeem client unchanged');
assert.ok(accept.includes('redeemSuccessRef'), 'invite race latch unchanged');
assert.ok(invites.includes('peek_parent_link_invite'), 'peek RPC unchanged');

assert.ok(nav.includes('touch-manipulation'), 'nav tap feedback');
assert.ok(nav.includes('active:scale-[0.96]'), 'visible click feedback');
assert.ok(nav.includes('to: \'/app/home\''), 'home tab route');

assert.ok(push.includes('pointer-events-none opacity-0'), 'invisible overlay cannot steal clicks');
assert.ok(push.includes('setTimeout(() => setOpen(true), 800)'), 'push delayed after home paint');
assert.ok(push.includes('if (!open || !entered) return'), 'scroll lock only after visible modal');

console.log('app-start-home-nav-test: OK');
