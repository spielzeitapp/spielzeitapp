import { useEffect } from 'react';
import { forceReleaseBodyScrollLocks, hasActiveBodyScrollLocks } from '../lib/bodyScrollLock';

/**
 * iOS/PWA Resume-Viewport-Fix.
 *
 * Problem: Nach Homescreen-Start, Safari-Resume oder bfcache-Restore liefern
 * `100svh`/`window.innerHeight` auf iOS oft noch veraltete Werte vom letzten
 * Einfrieren. Höhen-basierte Shells (Live-Screens) werden dann zu hoch/zu
 * niedrig gerendert: Inhalt abgeschnitten oder schwarze Lücke über der
 * BottomNav — bis ein manueller Refresh kommt (den es im Standalone-PWA-Modus
 * nicht gibt).
 *
 * Lösung: Die tatsächliche Viewport-Höhe wird als CSS-Variablen gepflegt
 * (`--app-vh` aus `innerHeight`, `--app-visual-vh` aus `visualViewport`) und
 * bei allen Resume-/Resize-Signalen neu gesetzt — inkl. verzögertem Recalc
 * (rAF + 150 ms), weil iOS direkt nach `pageshow`/`visibilitychange` häufig
 * noch stale Höhen meldet.
 */

function applyViewportVars(): void {
  const root = document.documentElement;

  const innerH = window.innerHeight;
  if (Number.isFinite(innerH) && innerH > 0) {
    root.style.setProperty('--app-vh', `${innerH * 0.01}px`);
  }

  const vv = window.visualViewport;
  // Bei Pinch-Zoom (scale > 1) keine Layout-Höhe aus dem Visual Viewport ableiten.
  if (vv && Number.isFinite(vv.height) && vv.height > 0 && (vv.scale ?? 1) <= 1.01) {
    root.style.setProperty('--app-visual-vh', `${vv.height * 0.01}px`);
  }

  root.dataset.viewportTick = String((Number(root.dataset.viewportTick ?? '0') || 0) + 1);
}

/** Zentral in App einhängen — pflegt --app-vh/--app-visual-vh über den App-Lebenszyklus. */
export function useViewportRecovery(): void {
  useEffect(() => {
    let rafId = 0;
    let timeoutId = 0;

    const recalc = () => {
      applyViewportVars();
    };

    /** Resume: sofort + rAF + 150 ms nachrechnen (iOS meldet erst verzögert korrekte Höhen). */
    const recover = () => {
      // bfcache/Races: hängengebliebene overflow:hidden-Styles ohne aktiven Lock lösen.
      if (!hasActiveBodyScrollLocks()) forceReleaseBodyScrollLocks();
      recalc();
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      rafId = requestAnimationFrame(recalc);
      timeoutId = window.setTimeout(recalc, 150);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };

    recover();

    window.addEventListener('pageshow', recover);
    window.addEventListener('focus', recover);
    window.addEventListener('orientationchange', recover);
    window.addEventListener('resize', recalc);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.visualViewport?.addEventListener('resize', recalc);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('pageshow', recover);
      window.removeEventListener('focus', recover);
      window.removeEventListener('orientationchange', recover);
      window.removeEventListener('resize', recalc);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.visualViewport?.removeEventListener('resize', recalc);
    };
  }, []);
}
