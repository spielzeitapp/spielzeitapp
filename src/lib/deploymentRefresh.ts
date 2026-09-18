const CHECK_THROTTLE_MS = 30_000;

let lastCheckAt = 0;
let reloadStarted = false;

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

    const reloadKey = `spz_deployment_reload:${latestEntry}`;
    if (sessionStorage.getItem(reloadKey) === '1') return;
    sessionStorage.setItem(reloadKey, '1');
    reloadStarted = true;
    window.location.reload();
  } catch {
    // Offline/Netzwerkfehler: Beim nächsten Öffnen erneut prüfen.
  }
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
