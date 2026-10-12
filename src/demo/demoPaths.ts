/**
 * Pfad-Helfer: /app ↔ /demo ohne produktive Routen zu hardcoden.
 */

import { useDemoMode } from './DemoContext';
import { useLocation } from 'react-router-dom';

export type InternalBasePath = '/app' | '/demo' | '/manager';

export function useInternalBasePath(): InternalBasePath {
  const demo = useDemoMode();
  const { pathname } = useLocation();
  return demo ? '/demo' : pathname.startsWith('/manager/') || pathname === '/manager' ? '/manager' : '/app';
}

/** `suffix` z. B. `/termine`, `events/xyz`, `/events/xyz`. */
export function internalPath(base: InternalBasePath, suffix: string): string {
  const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${base}${s}`;
}

/** Ersetzt führendes /app oder /demo; behält Rest. */
export function toInternalPath(pathname: string, base: InternalBasePath): string {
  const bare = pathname.replace(/^\/(app|demo|manager)(?=\/|$)/, '') || '/';
  return `${base}${bare.startsWith('/') ? bare : `/${bare}`}`;
}
