/**
 * Pfad-Helfer: /app ↔ /demo ohne produktive Routen zu hardcoden.
 */

import { useDemoMode } from './DemoContext';

export type InternalBasePath = '/app' | '/demo';

export function useInternalBasePath(): InternalBasePath {
  const demo = useDemoMode();
  return demo ? '/demo' : '/app';
}

/** `suffix` z. B. `/termine`, `events/xyz`, `/events/xyz`. */
export function internalPath(base: InternalBasePath, suffix: string): string {
  const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${base}${s}`;
}

/** Ersetzt führendes /app oder /demo; behält Rest. */
export function toInternalPath(pathname: string, base: InternalBasePath): string {
  const bare = pathname.replace(/^\/(app|demo)(?=\/|$)/, '') || '/';
  return `${base}${bare.startsWith('/') ? bare : `/${bare}`}`;
}
