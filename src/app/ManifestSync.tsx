import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MANIFEST_ID = 'app-manifest';

/** Interne Domain: volle App mit start_url /app (siehe index.html __HOST_IS_INTERNAL__). */
function isInternalDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as Window & { __HOST_IS_INTERNAL__?: boolean }).__HOST_IS_INTERNAL__ === true;
}

function ensureManifestLink(href: string): void {
  let link = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;
  if (!link) {
    const existing = document.querySelector('head link[rel="manifest"]');
    if (existing) existing.remove();
    link = document.createElement('link');
    link.rel = 'manifest';
    link.id = MANIFEST_ID;
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.href = href;
  }
}

/**
 * Setzt das PWA-Manifest nach Domain und Route:
 * - spielzeitapp.at / app.spielzeitapp.at → /manifest-trainer.json (start_url /app)
 * - localhost / andere Hosts auf /app → /manifest-trainer.json
 * - sonst → /manifest.json (nur lokale Public-Dev-Variante)
 */
export function ManifestSync(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    const href = isInternalDomain()
      ? '/manifest-trainer.json'
      : pathname.startsWith('/app')
        ? '/manifest-trainer.json'
        : '/manifest.json';
    ensureManifestLink(href);
  }, [pathname]);

  return null;
}
