import { useLayoutEffect } from 'react';
import { standaloneFullscreenHeight, standalonePageScale } from '../lib/standaloneViewport';
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

const VIEWPORT_ENTRY_KEY = 'sz_viewport_entry_v1';
/** An installed market window and an in-app route share URLs, not native geometry.
 * sessionStorage belongs to the current window and survives a theme reload. */
function viewportEntry(): 'market' | 'app' {
  const marketPath = /^\/(?:vereinsmarkt|marktplatz)\//i.test(window.location.pathname) || /^\/vereinsmarkt-manager(?:\/|$)/i.test(window.location.pathname) || (window.location.pathname==='/manager/vereinsmarkt'&&new URLSearchParams(window.location.search).get('from')==='vereinsmarkt-manager');
  try {
    if (!marketPath) {
      window.sessionStorage.setItem(VIEWPORT_ENTRY_KEY, 'app');
      return 'app';
    }
    const previous = window.sessionStorage.getItem(VIEWPORT_ENTRY_KEY);
    const entry = previous === 'app' ? 'app' : 'market';
    window.sessionStorage.setItem(VIEWPORT_ENTRY_KEY, entry);
    return entry;
  } catch {
    return marketPath ? 'market' : 'app';
  }
}

function applyViewportVars(entry: 'market' | 'app'): void {
  const root = document.documentElement;

  const innerH = window.innerHeight;
  const vv = window.visualViewport;
  const active = document.activeElement;
  const editing = active instanceof HTMLElement && (active.isContentEditable || active.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select'));
  // The market owns a bounded, fixed shell. Keep it inside the actual browser
  // viewport: screen.height also includes native status-bar space on iOS.
  // env(safe-area-inset-top) cannot reliably tell whether that space is outside
  // the viewport (including installs that retained older status-bar settings).
  const marketShell = root.hasAttribute('data-market-shell') || root.hasAttribute('data-market-manager-shell');
  const viewportInput = {
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    screenWidth: window.screen.width, screenHeight: window.screen.height,
    innerWidth: window.innerWidth, innerHeight: innerH,
    visibleHeight: vv?.height ?? innerH, visibleTop: vv?.offsetTop ?? 0,
    scale: vv?.scale ?? 1, editing,
  };
  // N8 device report: fixed viewport 812px on an 874px iPhone. In a
  // translucent install, the layout viewport omits native top-chrome space.
  // Compensate only the body-level nav, not the bounded content scroller.
  let marketBottomExtension = 0;
  if (marketShell && entry === 'market') {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)';
    document.body.appendChild(probe);
    const safeAreaTop = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    const full = standaloneFullscreenHeight({...viewportInput, safeAreaTop});
    if (full !== null) marketBottomExtension = Math.max(0, full - viewportInput.visibleHeight);
  }
  root.style.setProperty('--market-native-bottom-extension', `${marketBottomExtension}px`);
  // The installed window keeps its original status-bar geometry across routes.
  // A market-launched window must stay bounded after switching to /app too.
  const fullscreenHeight = entry === 'market' ? null : standaloneFullscreenHeight(viewportInput);
  const pageScale = standalonePageScale(viewportInput);
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
  // Publish page-zoom CSS heights too; keep the last stable height for actual pinch zoom.
  // Keyboard heights must still shrink the shell at the user's page-zoom setting.
  if (vv && Number.isFinite(vv.height) && vv.height > 0 && (pageScale !== null || Math.abs((vv.scale ?? 1) - 1) <= 0.01)) {
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
    const entry = viewportEntry();
    document.documentElement.dataset.viewportEntry = entry;
    let rafId = 0;
    let timeoutIds: number[] = [];

    const recalc = () => {
      applyViewportVars(entry);
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

    window.addEventListener('spz-viewport-recover', recover);
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
      window.removeEventListener('spz-viewport-recover', recover);
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
