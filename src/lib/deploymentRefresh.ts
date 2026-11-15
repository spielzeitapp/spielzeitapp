const CHECK_THROTTLE_MS = 30_000;
export const DEPLOYMENT_UPDATE_EVENT = 'spz:deployment-update-available';

let lastCheckAt = 0;
let reloadStarted = false;
let pendingDeploymentEntry: string | null = null;

function deploymentFingerprint(doc: Document): string | null {
  const elements=Array.from(doc.querySelectorAll<HTMLElement>('script[type="module"][src],link[rel="stylesheet"][href]'));
  const paths=elements.map(el=>el.getAttribute('src')||el.getAttribute('href')).filter((value):value is string=>Boolean(value)).map(value=>new URL(value,window.location.origin).pathname).filter(value=>value.includes('/assets/')).sort();
  return paths.length?paths.join('|'):null;
}
let initialFingerprint:string|null=null;

async function checkForNewDeployment(): Promise<void> {
  if (reloadStarted || document.visibilityState === 'hidden' || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheckAt < CHECK_THROTTLE_MS) return;
  lastCheckAt = now;

  const currentEntry = initialFingerprint;
  if (!currentEntry) return;

  try {
    const response = await fetch(`${window.location.pathname}?app-version=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return;

    const latestHtml = await response.text();
    const latestDocument = new DOMParser().parseFromString(latestHtml, 'text/html');
    const latestEntry = deploymentFingerprint(latestDocument);
    if (!latestEntry || latestEntry === currentEntry) return;

    try{if(sessionStorage.getItem(`spz_deployment_reload:${latestEntry}`)==='1')return;}catch{}
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
  try{sessionStorage.setItem(`spz_deployment_reload:${entry}`, '1');}catch{}
  reloadStarted = true;
  window.location.reload();
}

/** Aktualisiert eine länger geöffnete iOS-/Android-Web-App auf den neuesten Vercel-Build. */
export function registerDeploymentRefresh(): void {
  if (typeof window === 'undefined') return;

  initialFingerprint=deploymentFingerprint(document);
  const check = () => void checkForNewDeployment();
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  window.setInterval(check,60_000);
  document.addEventListener('visibilitychange', check);
  window.setTimeout(check, 2_000);
}
