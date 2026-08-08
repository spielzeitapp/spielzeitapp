/**
 * DEMO.2K — lokaler Rundgangstatus + Journey-Flags (sessionStorage).
 * Überlebt Navigation und Reload in derselben Browser-Session; Tab schließen = Reset.
 * Keine Supabase-/Cookie-Persistenz. Zentral über DEMO_STORAGE_KEYS.tourSession.
 */

import { DEMO_STORAGE_KEYS } from './demoFixtures';
import { DEMO_TOUR_STATION_COUNT, getDemoTourChapterProgress } from './demoTourConfig';

export type DemoTourPhase = 'idle' | 'active' | 'paused' | 'finished';

export type DemoTourLocalTraining = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  focus: string;
};

export type DemoTourJourney = {
  localTraining: DemoTourLocalTraining | null;
  trainingNoahStatus: 'yes' | 'no' | null;
  localMatchReady: boolean;
  matchNoahStatus: 'yes' | 'no' | null;
  chronicleNotes: string[];
};

export type DemoTourSnapshot = {
  phase: DemoTourPhase;
  /** 0-basiert; bei phase=finished = letzter Index (Abschlusskarte) */
  stepIndex: number;
  /** Abgeleitet aus Station – nicht separat persistiert nötig, aber im Snapshot verfügbar */
  chapterIndex?: number;
  journey: DemoTourJourney;
};

const STORAGE_KEY = DEMO_STORAGE_KEYS.tourSession;

const EMPTY_JOURNEY: DemoTourJourney = {
  localTraining: null,
  trainingNoahStatus: null,
  localMatchReady: false,
  matchNoahStatus: null,
  chronicleNotes: [],
};

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

function normalizeJourney(raw: Partial<DemoTourJourney> | undefined): DemoTourJourney {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_JOURNEY };
  const training = raw.localTraining;
  const localTraining: DemoTourLocalTraining | null =
    training &&
    typeof training === 'object' &&
    typeof training.id === 'string' &&
    typeof training.startsAt === 'string'
      ? {
          id: training.id,
          title: String(training.title ?? 'Training'),
          startsAt: training.startsAt,
          location: String(training.location ?? 'Sportplatz Rohrbach'),
          focus: String(training.focus ?? ''),
        }
      : null;
  return {
    localTraining,
    trainingNoahStatus:
      raw.trainingNoahStatus === 'yes' || raw.trainingNoahStatus === 'no'
        ? raw.trainingNoahStatus
        : null,
    localMatchReady: Boolean(raw.localMatchReady),
    matchNoahStatus:
      raw.matchNoahStatus === 'yes' || raw.matchNoahStatus === 'no' ? raw.matchNoahStatus : null,
    chronicleNotes: Array.isArray(raw.chronicleNotes)
      ? raw.chronicleNotes.map((n) => String(n)).filter(Boolean)
      : [],
  };
}

function withChapter(snap: Omit<DemoTourSnapshot, 'chapterIndex'>): DemoTourSnapshot {
  return {
    ...snap,
    chapterIndex: getDemoTourChapterProgress(snap.stepIndex).chapterIndex,
  };
}

function readRaw(): DemoTourSnapshot {
  if (typeof sessionStorage === 'undefined') {
    return withChapter({ phase: 'idle', stepIndex: 0, journey: { ...EMPTY_JOURNEY } });
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return withChapter({ phase: 'idle', stepIndex: 0, journey: { ...EMPTY_JOURNEY } });
    const parsed = JSON.parse(raw) as Partial<DemoTourSnapshot>;
    const phase: DemoTourPhase =
      parsed.phase === 'active' ||
      parsed.phase === 'finished' ||
      parsed.phase === 'paused'
        ? parsed.phase
        : 'idle';
    return withChapter({
      phase,
      stepIndex: clampStep(Number(parsed.stepIndex) || 0),
      journey: normalizeJourney(parsed.journey),
    });
  } catch {
    return withChapter({ phase: 'idle', stepIndex: 0, journey: { ...EMPTY_JOURNEY } });
  }
}

let snapshot: DemoTourSnapshot = readRaw();

function persist(next: DemoTourSnapshot): void {
  snapshot = withChapter(next);
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (snapshot.phase === 'idle') {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(DEMO_STORAGE_KEYS.tourDone);
      } else {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            phase: snapshot.phase,
            stepIndex: snapshot.stepIndex,
            journey: snapshot.journey,
          }),
        );
        if (snapshot.phase === 'finished') {
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
  return {
    ...snapshot,
    journey: { ...snapshot.journey, chronicleNotes: [...snapshot.journey.chronicleNotes] },
  };
}

export function getDemoTourJourney(): DemoTourJourney {
  return {
    ...snapshot.journey,
    chronicleNotes: [...snapshot.journey.chronicleNotes],
  };
}

export function patchDemoTourJourney(patch: Partial<DemoTourJourney>): DemoTourSnapshot {
  const nextJourney = normalizeJourney({ ...snapshot.journey, ...patch });
  const next = withChapter({
    phase: snapshot.phase === 'idle' ? 'active' : snapshot.phase,
    stepIndex: snapshot.stepIndex,
    journey: nextJourney,
  });
  persist(next);
  return next;
}

export function appendDemoChronicleNote(note: string): DemoTourSnapshot {
  const trimmed = note.trim();
  if (!trimmed) return getDemoTourSnapshot();
  const notes = snapshot.journey.chronicleNotes.includes(trimmed)
    ? snapshot.journey.chronicleNotes
    : [...snapshot.journey.chronicleNotes, trimmed];
  return patchDemoTourJourney({ chronicleNotes: notes });
}

export function startDemoTour(): DemoTourSnapshot {
  const next = withChapter({
    phase: 'active' as const,
    stepIndex: 0,
    journey: snapshot.journey.localTraining || snapshot.journey.localMatchReady
      ? snapshot.journey
      : { ...EMPTY_JOURNEY },
  });
  persist(next);
  return next;
}

/** Fortsetzen wenn paused/active; sonst neu starten. Finished → von vorn (Journey behalten bis Reset). */
export function resumeOrStartDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'active' || snapshot.phase === 'paused') {
    const next = withChapter({
      phase: 'active' as const,
      stepIndex: snapshot.stepIndex,
      journey: snapshot.journey,
    });
    persist(next);
    return next;
  }
  return startDemoTour();
}

export function setDemoTourStep(stepIndex: number): DemoTourSnapshot {
  const next = withChapter({
    phase: 'active' as const,
    stepIndex: clampStep(stepIndex),
    journey: snapshot.journey,
  });
  persist(next);
  return next;
}

export function advanceDemoTour(): DemoTourSnapshot {
  if (snapshot.phase !== 'active' && snapshot.phase !== 'paused') return getDemoTourSnapshot();
  if (snapshot.stepIndex >= DEMO_TOUR_STATION_COUNT - 1) {
    return finishDemoTour();
  }
  return setDemoTourStep(snapshot.stepIndex + 1);
}

export function retreatDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'finished') {
    return setDemoTourStep(DEMO_TOUR_STATION_COUNT - 1);
  }
  if (snapshot.phase !== 'active' && snapshot.phase !== 'paused') return getDemoTourSnapshot();
  return setDemoTourStep(Math.max(0, snapshot.stepIndex - 1));
}

export function finishDemoTour(): DemoTourSnapshot {
  const next = withChapter({
    phase: 'finished' as const,
    stepIndex: DEMO_TOUR_STATION_COUNT - 1,
    journey: snapshot.journey,
  });
  persist(next);
  return next;
}

/** Schließen: Fortschritt behalten, wiederaufnehmbar. */
export function pauseDemoTour(): DemoTourSnapshot {
  if (snapshot.phase === 'idle' || snapshot.phase === 'finished') {
    return getDemoTourSnapshot();
  }
  const next = withChapter({
    phase: 'paused' as const,
    stepIndex: snapshot.stepIndex,
    journey: snapshot.journey,
  });
  persist(next);
  return next;
}

/** Alias: Schließen → pausieren (nicht löschen). */
export function dismissDemoTour(): DemoTourSnapshot {
  return pauseDemoTour();
}

/** Vollständiger Tour-Reset inkl. Journey-Flags (z. B. Demo zurücksetzen). */
export function resetDemoTourState(): DemoTourSnapshot {
  const next = withChapter({
    phase: 'idle' as const,
    stepIndex: 0,
    journey: { ...EMPTY_JOURNEY },
  });
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
