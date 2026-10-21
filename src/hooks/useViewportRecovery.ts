import { useLayoutEffect } from 'react';
import { standaloneFullscreenHeight } from '../lib/standaloneViewport';
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
 * (rAF + verzögerten Messungen), weil iOS direkt nach `pageshow`/`visibilitychange` häufig
 * noch stale Höhen meldet.
 */

function applyViewportVars(): void {
  const root = document.documentElement;

  const innerH = window.innerHeight;
  const vv = window.visualViewport;
  const active = document.activeElement;
  const editing = active instanceof HTMLElement && (active.isContentEditable || active.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select'));
  const fullscreenHeight = standaloneFullscreenHeight({
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    screenWidth: window.screen.width, screenHeight: window.screen.height,
    innerWidth: window.innerWidth, innerHeight: innerH,
    visibleHeight: vv?.height ?? innerH, visibleTop: vv?.offsetTop ?? 0,
    scale: vv?.scale ?? 1, editing,
  });
  if (fullscreenHeight !== null) {
    root.dataset.iosStandaloneFullscreen = 'true';
    root.dataset.viewportSource = 'ios-homescreen';
    root.style.setProperty('--app-standalone-height', `${fullscreenHeight}px`);
  } else {
    delete root.dataset.iosStandaloneFullscreen;
    root.style.removeProperty('--app-standalone-height');
    root.dataset.viewportSource = 'viewport';
  }
  if (Number.isFinite(innerH) && innerH > 0) {
    root.style.setProperty('--app-vh', `${(fullscreenHeight ?? innerH) * 0.01}px`);
    if (!vv) {
      root.style.setProperty('--app-visible-height', `${fullscreenHeight ?? innerH}px`);
      root.style.setProperty('--app-visible-top', '0px');
    }
  }
  // Keep the last unzoomed height during pinch zoom.
  if (vv && Number.isFinite(vv.height) && vv.height > 0 && Math.abs((vv.scale ?? 1) - 1) <= 0.01) {
    const height = fullscreenHeight ?? vv.height;
    root.style.setProperty('--app-visual-vh', `${height * 0.01}px`);
    root.style.setProperty('--app-visible-height', `${height}px`);
    root.style.setProperty('--app-visible-top', `${fullscreenHeight !== null ? 0 : Math.max(0, vv.offsetTop || 0)}px`);
  }

  root.dataset.viewportTick = String((Number(root.dataset.viewportTick ?? '0') || 0) + 1);
}

/** Zentral in App einhängen — pflegt --app-vh/--app-visual-vh über den App-Lebenszyklus. */
export function useViewportRecovery(): void {
  useLayoutEffect(() => {
    let rafId = 0;
    let timeoutIds: number[] = [];

    const recalc = () => {
      applyViewportVars();
    };

    /** Measure before paint, then after iOS startup/rotation has settled. */
    const recover = () => {
      // bfcache/Races: hängengebliebene overflow:hidden-Styles ohne aktiven Lock lösen.
      if (!hasActiveBodyScrollLocks()) forceReleaseBodyScrollLocks();
      recalc();
      cancelAnimationFrame(rafId);
      timeoutIds.forEach(window.clearTimeout);
      rafId = requestAnimationFrame(recalc);
      timeoutIds = [150, 500, 1200].map(delay => window.setTimeout(recalc, delay));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };

    const onEditingChange = () => {
      recalc();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recalc);
    };
    recover();
    document.addEventListener('focusin', onEditingChange);
    document.addEventListener('focusout', onEditingChange);

    window.addEventListener('pageshow', recover);
    window.addEventListener('focus', recover);
    window.addEventListener('orientationchange', recover);
    window.addEventListener('resize', recalc);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.visualViewport?.addEventListener('resize', recalc);
    window.visualViewport?.addEventListener('scroll', recalc);

    return () => {
      cancelAnimationFrame(rafId);
      timeoutIds.forEach(window.clearTimeout);
      window.removeEventListener('pageshow', recover);
      window.removeEventListener('focus', recover);
      window.removeEventListener('orientationchange', recover);
      window.removeEventListener('resize', recalc);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('focusin', onEditingChange);
      document.removeEventListener('focusout', onEditingChange);
      window.visualViewport?.removeEventListener('resize', recalc);
      window.visualViewport?.removeEventListener('scroll', recalc);
    };
  }, []);
}
