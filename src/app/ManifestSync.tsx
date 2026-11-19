import {uscAuthTarget} from '../features/club/uscAuth';
import { isUscAppPath, USC_MANIFEST, USC_APP_ICON } from '../features/club/uscClub';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MANIFEST_ID = 'app-manifest';

/** Interne Domain: volle App mit start_url /app (siehe index.html __HOST_IS_INTERNAL__). */
function isInternalDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as Window & { __HOST_IS_INTERNAL__?: boolean }).__HOST_IS_INTERNAL__ === true;
}

function ensureManifestLink(href: string): void {
  let link = (document.getElementById(MANIFEST_ID) ?? document.querySelector('head link[rel="manifest"]')) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  // Reuse the initial link: installation must not observe an intermediate manifest.
  link.id = MANIFEST_ID;
  if (link.getAttribute('href') !== href) {
    link.href = href;
  }
}

/**
 * Setzt das PWA-Manifest nach Domain und Route:
 * - /demo → eigenes Demo-Manifest (öffentlicher Start ohne Login)
 * - /manager → eigenes Manager-Manifest (start_url /manager)
 * - spielzeitapp.at / app.spielzeitapp.at sonst → /manifest-trainer.json (start_url /app)
 * - localhost / andere Hosts auf /app → /manifest-trainer.json
 * - sonst → /manifest.json (nur lokale Public-Dev-Variante)
 */
export function ManifestSync(): null {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const marketManager=/^\/vereinsmarkt-manager(?:\/|$)/.test(pathname)||(pathname==='/manager/vereinsmarkt'&&new URLSearchParams(search).get('from')==='vereinsmarkt-manager');
    const marketplace = pathname.match(/^\/(?:vereinsmarkt|marktplatz)\/([0-9a-f-]{36})(?:\/|$)/i);
    const usc = isUscAppPath(pathname) || Boolean(uscAuthTarget(pathname,search));
    const demo = pathname === '/demo' || pathname.startsWith('/demo/');
    const manager = pathname.startsWith('/manager');
    const href = marketManager ? '/vereinsmarkt-manager/manifest.webmanifest' : marketplace ? (marketplace[1]==='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a' ? '/vereinsmarkt/rohrbach-v2.webmanifest' : `/api/exchange/public?manifest=1&club=${marketplace[1]}`) : usc ? USC_MANIFEST : demo
      ? '/manifest-demo.json'
      : manager
      ? '/manifest-manager.json'
      : isInternalDomain()
      ? '/manifest-trainer.json'
      : pathname.startsWith('/app')
        ? '/manifest-trainer.json'
        : '/manifest.json';
    ensureManifestLink(href);
    const icon = document.querySelector('head link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (icon) icon.href = marketManager ? '/vereinsmarkt-manager/icon-180.png' : marketplace ? '/vereinsmarkt/icon-180.png' : usc ? USC_APP_ICON : manager ? '/manager-apple-touch-icon.png' : '/apple-touch-icon.png';
    const title = document.querySelector('head meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (title) title.content = marketManager ? 'VM Manager' : marketplace ? 'Vereinsmarkt' : usc ? 'USC Rohrbach' : demo ? 'Spielzeit Demo' : manager ? 'Spielzeit Manager' : 'SpielzeitApp';
    if (marketManager) document.title = 'Vereinsmarkt-Manager';
    else if (marketplace) document.title = 'Vereinsmarkt';
    else if (usc) document.title = 'USC Rohrbach';
    else if (demo) document.title = 'SpielzeitApp Demo';
    else if (manager) document.title = 'Spielzeit Manager';
    else if (document.title === 'Spielzeit Manager' || document.title === 'SpielzeitApp Demo' || document.title === 'USC Rohrbach' || document.title === 'Vereinsmarkt' || document.title === 'Vereinsmarkt-Manager') document.title = 'SpielzeitApp';
  }, [pathname, search]);

  return null;
}
