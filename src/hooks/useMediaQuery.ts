import { useEffect, useState } from 'react';

/**
 * Zentrale Layout-Entscheidung: Touch-Geräte (iPhone, iPad) bekommen BottomTabs,
 * Desktop (Maus/Präzision) bekommt TopNav. iPad fällt auch bei Breite > 1024 nicht ins Desktop-Layout.
 * Nutzt pointer: coarse + hover: none, optional Viewport-Breite.
 */
function getIsTouchLayout(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  const narrow = window.innerWidth <= 1024;
  return coarse || noHover || narrow;
}

/**
 * Hook: isTouchLayout (true = nur BottomTabs, false = nur TopNav).
 * Reagiert auf Änderungen via matchMedia('change') und resize.
 */
export function useIsTouchLayout(): boolean {
  const [isTouchLayout, setIsTouchLayout] = useState<boolean>(getIsTouchLayout);

  useEffect(() => {
    const mqlCoarse = window.matchMedia('(pointer: coarse)');
    const mqlHover = window.matchMedia('(hover: none)');

    const update = () => setIsTouchLayout(getIsTouchLayout());

    mqlCoarse.addEventListener('change', update);
    mqlHover.addEventListener('change', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      mqlCoarse.removeEventListener('change', update);
      mqlHover.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isTouchLayout;
}

/** Einzelne Media-Query (z.B. für andere Komponenten). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
