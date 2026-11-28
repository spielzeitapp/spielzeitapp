import { isStandaloneDisplayMode } from '../pwaDisplayMode';
import { clearAppBadgeSafe } from './appBadge';

const uuid = '[0-9a-fA-F-]{36}';
const launchKey = 'spielzeit-installed-surface';
type Surface = 'spielzeit' | 'market' | 'market-manager';
type Launch = { surface: Surface; clubId?: string };

function installedLaunch(): Launch | null {
  if (!isStandaloneDisplayMode()) return null;
  const path = window.location.pathname;
  const club = path.match(new RegExp(`^/(?:vereinsmarkt|marktplatz)/(${uuid})(?:/|$)`))?.[1]?.toLowerCase();
  const launch: Launch = /^\/vereinsmarkt-manager(?:\/|$)/.test(path) ? { surface: 'market-manager' }
    : club ? { surface: 'market', clubId: club } : { surface: 'spielzeit' };
  try {
    const saved = sessionStorage.getItem(launchKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Launch;
      if (parsed.surface === 'market' && parsed.clubId && new RegExp(`^${uuid}$`).test(parsed.clubId)) return parsed;
      if (parsed.surface === 'market-manager' || parsed.surface === 'spielzeit') return parsed;
    }
    sessionStorage.setItem(launchKey, JSON.stringify(launch));
  } catch { /* The current entry point is still available without storage. */ }
  return launch;
}

const launch = installedLaunch();
export const installedPushSurface = launch?.surface;

export function ownsMarketBadge(clubId?: string): boolean {
  if (launch?.surface !== 'market' || !clubId) return false;
  const launchClub = launch.clubId === '9c7a8741-6e73-42d5-88d8-46ce5217e8cd' &&
    window.location.hostname === 'app.spielzeitapp.at'
      ? '3db6fce2-a4c1-44a5-a333-19d1d4d62e6a' : launch.clubId;
  return launchClub === clubId.toLowerCase();
}

export function marketWorkerScope(clubId: string): string {
  return `/vereinsmarkt/${encodeURIComponent(clubId.toLowerCase())}`;
}

export async function findPushRegistration(scope: string): Promise<ServiceWorkerRegistration | undefined> {
  const registration = await navigator.serviceWorker.getRegistration(scope);
  return registration?.scope === new URL(scope, window.location.origin).href ? registration : undefined;
}

export function isIsolatedIosHomeApp(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function legacyMarketSubscription(): Promise<PushSubscription | undefined> {
  // WebKit home-screen installations have their own storage. Other browsers may
  // share the root registration with the main app and must leave it alone.
  if (!isIsolatedIosHomeApp() || (installedPushSurface !== 'market' && installedPushSurface !== 'market-manager')) return;
  const registration = await findPushRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? undefined;
}

export async function clearLegacyMarketManagerBadge(): Promise<void> {
  if (installedPushSurface !== 'market-manager') return;
  try {
    const subscription = await legacyMarketSubscription();
    if (subscription) await subscription.unsubscribe();
  } finally {
    await clearAppBadgeSafe();
  }
}
