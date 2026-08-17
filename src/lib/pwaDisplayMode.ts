/**
 * iOS Home-Bildschirm / installierte PWA vs. Safari-Browser.
 * Keine Auth- oder Invite-Logik.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  // iOS Safari: navigator.standalone is true after „Zum Home-Bildschirm“.
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch {
    return false;
  }
  return false;
}
