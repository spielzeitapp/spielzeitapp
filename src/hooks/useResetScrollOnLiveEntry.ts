import { useLayoutEffect } from 'react';

type ScrollContainerRef = { readonly current: HTMLElement | null };

/**
 * Scroll-Reset für den LiveMatchScreen.
 *
 * Problem: Die Live-„Unterseiten“ (Übersicht/Aufstellung/Liveticker/Statistik)
 * sind Tabs im selben Screen — die Scrollcontainer (Hub-Header bzw. das
 * Live-Scroll-Div) werden nur per CSS-Klassen umgeschaltet und behalten ihre
 * alte scrollTop-Position. Zusätzlich kann iOS/PWA über die Browser-Scroll-
 * Restoration (bfcache/History) eine alte window-Scrollposition
 * wiederherstellen. Ergebnis: Nach „zurück zum Livespiel“ startet der Screen
 * mitten im Inhalt statt oben.
 *
 * Lösung: Bei jedem Eintritt (Route-Mount via location.key und jedem
 * Tab-Wechsel via resetKey) window/document/body sowie alle übergebenen
 * Container zuverlässig auf scrollTop 0 setzen — sofort, nach rAF und nach
 * 50/150 ms (iOS stellt Scrollpositionen teils verzögert wieder her).
 * Solange der Live-Screen gemountet ist, wird die Browser-Scroll-Restoration
 * auf 'manual' gestellt (beim Unmount wiederhergestellt) — bewusst nur hier,
 * nicht global.
 */
export function useResetScrollOnLiveEntry(
  resetKey: string,
  containerRefs: ReadonlyArray<ScrollContainerRef>,
): void {
  // Browser-/bfcache-Scroll-Restore nur für die Lebensdauer des Live-Screens deaktivieren.
  useLayoutEffect(() => {
    let prev: ScrollRestoration | null = null;
    try {
      prev = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    } catch {
      prev = null;
    }
    return () => {
      try {
        if (prev) window.history.scrollRestoration = prev;
      } catch {
        /* noop */
      }
    };
  }, []);

  useLayoutEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      for (const ref of containerRefs) {
        const el = ref.current;
        if (el) el.scrollTop = 0;
      }
    };

    reset();
    const rafId = requestAnimationFrame(reset);
    // iOS/PWA stellt Scrollpositionen teils erst nach dem ersten Paint wieder her.
    const t1 = window.setTimeout(reset, 50);
    const t2 = window.setTimeout(reset, 150);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // containerRefs sind stabile useRef-Objekte — nur resetKey triggert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
}
