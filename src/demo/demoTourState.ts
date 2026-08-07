/**
 * DEMO.2J — lokaler Rundgangstatus (sessionStorage).
 * Überlebt Navigation und Reload in derselben Browser-Session; Tab schließen = Reset.
 * Keine Supabase-/Cookie-Persistenz. Zentral über DEMO_STORAGE_KEYS.tourSession.
 */

import { DEMO_STORAGE_KEYS } from './demoFixtures';
import { DEMO_TOUR_STATION_COUNT } from './demoTourConfig';

export type DemoTourPhase = 'idle' | 'active' | 'paused' | 'finished';

export type DemoTourSnapshot = {
  phase: DemoTourPhase;
  /** 0-basiert; bei phase=finished = letzter Index (Abschlusskarte) */
  stepIndex: number;
};

const STORAGE_KEY = DEMO_STORAGE_KEYS.tourSession;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function clampStep(stepIndex: number): number {
  return Math.max(0, Math.min(DEMO_TOUR_STATION_COUNT - 1, Math.trunc(stepIndex)));
}

function readRaw(): DemoTourSnapshot {
  if (typeof sessionStorage === 'undefined') {
    return { phase: 'idle', stepIndex: 0 };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { phase: 'idle', stepIndex: 0 };
    const parsed = JSON.parse(raw) as Partial<DemoTourSnapshot>;
    const phase: DemoTourPhase =
      parsed.phase === 'active' ||
      parsed.phase === 'finished' ||
      parsed.phase === 'paused'
        ? parsed.phase
        : 'idle';
    return { phase, stepIndex: clampStep(Number(parsed.stepIndex) || 0) };
  } catch {
    return { phase: 'idle', stepIndex: 0 };
  }
}

let snapshot: DemoTourSnapshot = readRaw();

function persist(next: DemoTourSnapshot): void {
  snapshot = next;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (next.phase === 'idle') {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(DEMO_STORAGE_KEYS.tourDone);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (next.phase === 'finished') {
          sessionStorage.setItem(DEMO_STORAGE_KEYS.tourDone, '1');
        } else {
          sessionStorage.removeItem(DEMO_STORAGE_KEYS.tourDone);
        }
      }
    }
  } catch {
    /* private mode etc. */
  }
  notify();
}

export function subscribeDemoTour(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDemoTourSnapshot(): DemoTourSnapshot {
  return { ...snapshot };
}

export function startDemoTour(): DemoTourSnapshot {
  const next = { phase: 'active' as const, stepIndex: 0 };
  persist(next);
  return next;
}

/** Fortsetzen wenn paused/active; sonst neu starten. Finished → von vorn. */
export function resumeOrStartDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'active' || snapshot.phase === 'paused') {
    const next = { phase: 'active' as const, stepIndex: snapshot.stepIndex };
    persist(next);
    return next;
  }
  return startDemoTour();
}

export function setDemoTourStep(stepIndex: number): DemoTourSnapshot {
  const next = { phase: 'active' as const, stepIndex: clampStep(stepIndex) };
  persist(next);
  return next;
}

export function advanceDemoTour(): DemoTourSnapshot {
  if (snapshot.phase !== 'active' && snapshot.phase !== 'paused') return { ...snapshot };
  if (snapshot.stepIndex >= DEMO_TOUR_STATION_COUNT - 1) {
    return finishDemoTour();
  }
  return setDemoTourStep(snapshot.stepIndex + 1);
}

export function retreatDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'finished') {
    return setDemoTourStep(DEMO_TOUR_STATION_COUNT - 1);
  }
  if (snapshot.phase !== 'active' && snapshot.phase !== 'paused') return { ...snapshot };
  return setDemoTourStep(Math.max(0, snapshot.stepIndex - 1));
}

export function finishDemoTour(): DemoTourSnapshot {
  const next = { phase: 'finished' as const, stepIndex: DEMO_TOUR_STATION_COUNT - 1 };
  persist(next);
  return next;
}

/** Schließen: Fortschritt behalten, wiederaufnehmbar. */
export function pauseDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'idle' || snapshot.phase === 'finished') {
    return { ...snapshot };
  }
  const next = { phase: 'paused' as const, stepIndex: snapshot.stepIndex };
  persist(next);
  return next;
}

/** Alias: Schließen → pausieren (nicht löschen). */
export function dismissDemoTour(): DemoTourSnapshot {
  return pauseDemoTour();
}

/** Vollständiger Tour-Reset (z. B. Demo zurücksetzen). */
export function resetDemoTourState(): DemoTourSnapshot {
  const next = { phase: 'idle' as const, stepIndex: 0 };
  persist(next);
  return next;
}

export function isDemoTourResumable(phase: DemoTourPhase = snapshot.phase): boolean {
  return phase === 'active' || phase === 'paused';
}

export function isDemoTourOverlayVisible(phase: DemoTourPhase = snapshot.phase): boolean {
  return phase === 'active' || phase === 'finished';
}

/** @deprecated Alias für isDemoTourResumable */
export function canResumeDemoTour(phase: DemoTourPhase = snapshot.phase): boolean {
  return isDemoTourResumable(phase);
}
