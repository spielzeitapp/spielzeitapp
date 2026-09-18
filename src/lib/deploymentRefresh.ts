const CHECK_THROTTLE_MS = 30_000;
export const DEPLOYMENT_UPDATE_EVENT = 'spz:deployment-update-available';

let lastCheckAt = 0;
let reloadStarted = false;
let pendingDeploymentEntry: string | null = null;

function entryScriptPath(doc: Document): string | null {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  const entry = scripts.find((script) => script.src.includes('/assets/main-')) ?? scripts[0];
  if (!entry?.src) return null;
  try {
    return new URL(entry.src, window.location.origin).pathname;
  } catch {
    return entry.getAttribute('src');
  }
}

async function checkForNewDeployment(): Promise<void> {
  if (reloadStarted || document.visibilityState === 'hidden' || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheckAt < CHECK_THROTTLE_MS) return;
  lastCheckAt = now;

  const currentEntry = entryScriptPath(document);
  if (!currentEntry || !currentEntry.includes('/assets/main-')) return;

  try {
    const response = await fetch(`/index.html?app-version=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return;

    const latestHtml = await response.text();
    const latestDocument = new DOMParser().parseFromString(latestHtml, 'text/html');
    const latestEntry = entryScriptPath(latestDocument);
    if (!latestEntry || latestEntry === currentEntry) return;

    if (sessionStorage.getItem(`spz_deployment_reload:${latestEntry}`) === '1') return;
    pendingDeploymentEntry = latestEntry;
    window.dispatchEvent(
      new CustomEvent(DEPLOYMENT_UPDATE_EVENT, { detail: { entry: latestEntry } }),
    );
  } catch {
    // Offline/Netzwerkfehler: Beim nächsten Öffnen erneut prüfen.
  }
}

export function getPendingDeploymentEntry(): string | null {
  return pendingDeploymentEntry;
}

export function refreshToDeployment(entry: string): void {
  if (!entry || reloadStarted) return;
  sessionStorage.setItem(`spz_deployment_reload:${entry}`, '1');
  reloadStarted = true;
  window.location.reload();
}

/** Aktualisiert eine länger geöffnete iOS-/Android-Web-App auf den neuesten Vercel-Build. */
export function registerDeploymentRefresh(): void {
  if (typeof window === 'undefined') return;

  const check = () => void checkForNewDeployment();
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  window.setTimeout(check, 2_000);
}
