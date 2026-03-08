import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MANIFEST_ID = 'app-manifest';

/** Interne Domain: Trainer-PWA mit start_url /app. */
function isInternalDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'app.spielzeitapp.at';
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
 * - app.spielzeitapp.at → immer /manifest-trainer.json (start_url /app)
 * - spielzeitapp.at / www → /manifest.json (start_url /)
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
