/**
 * Zentraler, referenzgezählter Body-Scroll-Lock für Sheets/Modals.
 *
 * Problem vorher: Mehrere Komponenten setzten `document.body.style.overflow = 'hidden'`
 * und stellten beim Schließen den jeweils gemerkten Vorgängerwert wieder her. Bei
 * überlappenden Sheets/Modals (oder Unmount in anderer Reihenfolge) blieb dadurch
 * `overflow: hidden` auf body/html hängen — die Seite war auf iOS nicht mehr scrollbar.
 */

let lockCount = 0;

function applyLockStyles(locked: boolean): void {
  document.body.style.overflow = locked ? 'hidden' : '';
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}

/**
 * Scroll-Lock anfordern. Gibt eine idempotente Release-Funktion zurück.
 * Erst wenn alle Locks freigegeben sind, wird das Scrollen wieder aktiviert.
 */
export function lockBodyScroll(): () => void {
  lockCount += 1;
  if (lockCount === 1) applyLockStyles(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) applyLockStyles(false);
  };
}

/** Notbremse: alle Locks lösen (z. B. Live-Nav-Reset, defensives Aufräumen). */
export function forceReleaseBodyScrollLocks(): void {
  lockCount = 0;
  applyLockStyles(false);
}
