import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { DEMO_TOUR_FINISH, DEMO_TOUR_STATION_COUNT, DEMO_TOUR_STATIONS } from '../demoTourConfig';
import {
  advanceDemoTour,
  dismissDemoTour,
  finishDemoTour,
  getDemoTourSnapshot,
  retreatDemoTour,
  setDemoTourStep,
  subscribeDemoTour,
  type DemoTourSnapshot,
} from '../demoTourState';

/**
 * Kompakte Orientierungskarte über der Bottom-Nav — blockiert die App nicht.
 */
export function DemoTourOverlay(): React.ReactElement | null {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<DemoTourSnapshot>(() => getDemoTourSnapshot());

  useEffect(() => subscribeDemoTour(() => setSnap(getDemoTourSnapshot())), []);

  const goToStep = useCallback(
    (stepIndex: number) => {
      const next = setDemoTourStep(stepIndex);
      const station = DEMO_TOUR_STATIONS[next.stepIndex];
      if (station) navigate(station.path);
    },
    [navigate],
  );

  const onNext = useCallback(() => {
    if (snap.phase === 'finished') {
      dismissDemoTour();
      return;
    }
    if (snap.stepIndex >= DEMO_TOUR_STATION_COUNT - 1) {
      finishDemoTour();
      return;
    }
    const next = advanceDemoTour();
    if (next.phase === 'active') {
      const station = DEMO_TOUR_STATIONS[next.stepIndex];
      if (station) navigate(station.path);
    }
  }, [navigate, snap.phase, snap.stepIndex]);

  const onBack = useCallback(() => {
    if (snap.phase === 'finished') {
      goToStep(DEMO_TOUR_STATION_COUNT - 1);
      return;
    }
    if (snap.stepIndex <= 0) return;
    const next = retreatDemoTour();
    const station = DEMO_TOUR_STATIONS[next.stepIndex];
    if (station) navigate(station.path);
  }, [goToStep, navigate, snap.phase, snap.stepIndex]);

  const onSkip = useCallback(() => {
    dismissDemoTour();
  }, []);

  const onExploreFree = useCallback(() => {
    dismissDemoTour();
  }, []);

  const onRestart = useCallback(() => {
    goToStep(0);
  }, [goToStep]);

  if (snap.phase === 'idle') return null;

  const isFinish = snap.phase === 'finished';
  const station = DEMO_TOUR_STATIONS[snap.stepIndex];
  const title = isFinish ? DEMO_TOUR_FINISH.title : station?.title ?? '';
  const body = isFinish ? DEMO_TOUR_FINISH.body : station?.body ?? '';
  const progressLabel = isFinish
    ? 'Abschluss'
    : `${snap.stepIndex + 1} von ${DEMO_TOUR_STATION_COUNT}`;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3 max-lg:bottom-[max(5.75rem,calc(4.75rem+env(safe-area-inset-bottom,0px)))] lg:bottom-6"
      role="region"
      aria-label="Demo-Rundgang"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/95 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/90">
              Demo-Rundgang · {progressLabel}
            </p>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white sm:text-[16px]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/10 text-white/55 hover:bg-white/5 hover:text-white"
            aria-label="Rundgang beenden"
          >
            <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <p className="text-[12px] leading-snug text-white/65 sm:text-[13px]">{body}</p>

        {!isFinish ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={snap.stepIndex <= 0}
              className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] flex-1 touch-manipulation items-center justify-center gap-1 rounded-full px-3 text-[12px] font-semibold disabled:opacity-40`}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              Zurück
            </button>
            <button
              type="button"
              onClick={onNext}
              className={`${dsPrimaryCtaClass()} inline-flex min-h-[40px] flex-[1.4] touch-manipulation items-center justify-center gap-1 rounded-full px-3 text-[12px] font-semibold`}
            >
              {snap.stepIndex >= DEMO_TOUR_STATION_COUNT - 1 ? 'Abschluss' : 'Weiter'}
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="w-full text-center text-[11px] font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            >
              Überspringen
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onExploreFree}
              className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
            >
              Demo frei weiter testen
            </button>
            <button
              type="button"
              onClick={onRestart}
              className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
            >
              Rundgang neu starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
