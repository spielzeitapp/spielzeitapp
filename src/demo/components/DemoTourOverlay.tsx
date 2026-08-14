import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, X } from 'lucide-react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  DEMO_LOOSDORF_EVENT_ID,
  DEMO_TOUR_END_MATCH_CONFIRM,
  DEMO_TOUR_FINISH,
  DEMO_TOUR_STATION_COUNT,
  DEMO_TOUR_STATIONS,
  DEMO_TOUR_WHAT_PATH,
  getDemoTourChapterProgress,
} from '../demoTourConfig';
import {
  advanceDemoTour,
  finishDemoTour,
  getDemoTourJourney,
  getDemoTourSnapshot,
  isDemoTourOverlayVisible,
  pauseDemoTour,
  startDemoTour,
  subscribeDemoTour,
  type DemoTourSnapshot,
} from '../demoTourState';
import {
  finishDemoLiveMatchForTour,
  requestDemoTourFocusPlaytime,
  requestDemoTourPrimaryAction,
} from '../demoTourActions';
import { useDemoMode } from '../DemoContext';
import { DemoWinnerPostPreview } from './DemoWinnerPostPreview';

/**
 * Kompakte Orientierungskarte über der Bottom-Nav — blockiert die App nicht.
 */
export function DemoTourOverlay(): React.ReactElement | null {
  const navigate = useNavigate();
  const demo = useDemoMode();
  const [snap, setSnap] = useState<DemoTourSnapshot>(() => getDemoTourSnapshot());
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [endingMatch, setEndingMatch] = useState(false);

  useEffect(() => subscribeDemoTour(() => setSnap(getDemoTourSnapshot())), []);

  const loosdorfEvent = useMemo(
    () => demo?.fixtures.events.find((e) => e.id === DEMO_LOOSDORF_EVENT_ID) ?? null,
    [demo?.fixtures.events],
  );

  const navigateToStation = useCallback(
    (stepIndex: number) => {
      const station = DEMO_TOUR_STATIONS[stepIndex];
      if (station) navigate(station.path);
    },
    [navigate],
  );

  const onPause = useCallback(() => {
    setEndConfirmOpen(false);
    setDirectionsOpen(false);
    setWinnerOpen(false);
    pauseDemoTour();
  }, []);

  const onExploreFree = useCallback(() => {
    setEndConfirmOpen(false);
    setDirectionsOpen(false);
    setWinnerOpen(false);
    pauseDemoTour();
  }, []);

  const onWinnerContinue = useCallback(() => {
    setWinnerOpen(false);
    const next = advanceDemoTour();
    if (next.phase === 'active') navigateToStation(next.stepIndex);
  }, [navigateToStation]);

  const onRestart = useCallback(() => {
    setWinnerOpen(false);
    setEndConfirmOpen(false);
    setDirectionsOpen(false);
    startDemoTour();
    navigate(DEMO_TOUR_WHAT_PATH, { replace: true });
  }, [navigate]);

  const advanceToNext = useCallback(() => {
    const next = advanceDemoTour();
    if (next.phase === 'active') {
      navigateToStation(next.stepIndex);
    }
  }, [navigateToStation]);

  const handlePrimary = useCallback(() => {
    if (snap.phase === 'finished') {
      pauseDemoTour();
      return;
    }
    const station = DEMO_TOUR_STATIONS[snap.stepIndex];
    if (!station) return;
    const journey = getDemoTourJourney();

    switch (station.primaryAction) {
      case 'save_training':
        if (journey.localTraining) advanceToNext();
        else requestDemoTourPrimaryAction();
        break;
      case 'save_match':
        if (journey.localMatchReady) advanceToNext();
        else requestDemoTourPrimaryAction();
        break;
      case 'parent_yes_training':
        if (journey.trainingNoahStatus) advanceToNext();
        else requestDemoTourPrimaryAction();
        break;
      case 'parent_yes_match':
        if (journey.matchNoahStatus) advanceToNext();
        else requestDemoTourPrimaryAction();
        break;
      case 'show_directions':
        setDirectionsOpen(true);
        break;
      case 'end_match':
        setEndConfirmOpen(true);
        break;
      case 'show_winner_preview':
        setWinnerOpen(true);
        break;
      case 'finish':
        finishDemoTour();
        break;
      case 'advance':
      default: {
        if (station.id === 'playtime') {
          requestDemoTourFocusPlaytime();
        }
        advanceToNext();
        break;
      }
    }
  }, [advanceToNext, snap.phase, snap.stepIndex]);

  const confirmEndMatch = useCallback(() => {
    setEndingMatch(true);
    setEndConfirmOpen(false);
    finishDemoLiveMatchForTour();
    window.setTimeout(() => {
      setEndingMatch(false);
      const next = advanceDemoTour();
      if (next.phase === 'active') navigateToStation(next.stepIndex);
    }, 450);
  }, [navigateToStation]);

  const confirmDirectionsContinue = useCallback(() => {
    setDirectionsOpen(false);
    advanceToNext();
  }, [advanceToNext]);

  if (!isDemoTourOverlayVisible(snap.phase)) return null;

  const isFinish = snap.phase === 'finished';
  const station = DEMO_TOUR_STATIONS[snap.stepIndex];
  const chapter = getDemoTourChapterProgress(snap.stepIndex);
  const title = isFinish ? DEMO_TOUR_FINISH.title : station?.title ?? '';
  const body = isFinish ? DEMO_TOUR_FINISH.body : station?.body ?? '';
  const benefit = isFinish ? null : station?.benefit ?? null;
  const progressLabel = isFinish
    ? 'Abschluss'
    : `${snap.stepIndex + 1} von ${DEMO_TOUR_STATION_COUNT}`;
  const chapterLabel = isFinish
    ? 'What if'
    : `${chapter.chapterLabel} · Schritt ${chapter.stepInChapter}/${chapter.stepsInChapter}`;
  const primaryLabel = isFinish
    ? 'Demo frei weiter testen'
    : station?.primaryActionLabel ?? 'Weiter';

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3 max-lg:bottom-[max(5.75rem,calc(4.75rem+env(safe-area-inset-bottom,0px)))] lg:bottom-6"
        role="region"
        aria-label="Demo-Rundgang"
      >
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/95 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/90">
                {chapterLabel} · {progressLabel}
              </p>
              <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white sm:text-[16px]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onPause}
              className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/10 text-white/55 hover:bg-white/5 hover:text-white"
              aria-label="Rundgang später fortsetzen"
            >
              <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          <p className="text-[12px] leading-snug text-white/65 sm:text-[13px]">{body}</p>
          {benefit ? (
            <p className="mt-2 text-[12px] font-medium leading-snug text-emerald-300/90 sm:text-[13px]">
              {benefit}
            </p>
          ) : null}

          {isFinish ? (
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {DEMO_TOUR_FINISH.benefits.map((b) => (
                <li key={b} className="text-[11px] leading-snug text-white/50">
                  · {b}
                </li>
              ))}
            </ul>
          ) : null}

          {!isFinish ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePrimary}
                disabled={endingMatch}
                className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold disabled:opacity-50`}
              >
                {endingMatch ? 'Wird beendet…' : primaryLabel}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onExploreFree}
                  className="text-[11px] font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Frei erkunden
                </button>
                <button
                  type="button"
                  onClick={onPause}
                  className="text-[11px] font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Später fortsetzen
                </button>
              </div>
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
                Rundgang erneut starten
              </button>
              <button
                type="button"
                onClick={() => {
                  demo?.resetAllDemo();
                  navigate('/demo/home', { replace: true });
                }}
                className="w-full py-1 text-center text-[11px] font-medium text-red-300/80 underline-offset-2 hover:text-red-200 hover:underline"
              >
                Demo zurücksetzen
              </button>
            </div>
          )}
        </div>
      </div>

      {directionsOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-10 sm:items-center"
          role="presentation"
          onClick={() => setDirectionsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-directions-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-400" strokeWidth={2} aria-hidden />
              <h3 id="demo-directions-title" className="text-[16px] font-semibold text-white">
                Anfahrt ansehen
              </h3>
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
                <dt className="text-white/45">Spielort</dt>
                <dd className="text-right font-medium text-white/90">
                  {loosdorfEvent?.location ?? 'Sportplatz Rohrbach'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
                <dt className="text-white/45">Gegner</dt>
                <dd className="text-right font-medium text-white/90">
                  {loosdorfEvent?.opponent ?? 'SV Loosdorf U12'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
                <dt className="text-white/45">Beginn</dt>
                <dd className="text-right font-medium text-white/90">10:30 Uhr</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
                <dt className="text-white/45">Treffpunkt</dt>
                <dd className="text-right font-medium text-white/90">09:45 Uhr</dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-white/45">Empfohlene Ankunft</dt>
                <dd className="text-right font-medium text-white/90">09:45 Uhr</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-snug text-white/40">
              Lokale Demo-Ansicht – keine externe Navigation und keine Maps-API.
            </p>
            <button
              type="button"
              onClick={confirmDirectionsContinue}
              className={`${dsPrimaryCtaClass()} mt-3 inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
            >
              Match vorbereiten
            </button>
          </div>
        </div>
      ) : null}

      {endConfirmOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 px-4"
          role="presentation"
          onClick={() => setEndConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-500/40 bg-neutral-950 p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-end-match-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="demo-end-match-title" className="text-[17px] font-semibold text-white">
              Demo-Spiel beenden?
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-white/65">{DEMO_TOUR_END_MATCH_CONFIRM}</p>
            <div className="mt-4 flex flex-col gap-2 min-[400px]:flex-row">
              <button
                type="button"
                onClick={() => setEndConfirmOpen(false)}
                className={`${dsSecondaryCtaClass()} inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmEndMatch}
                className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
              >
                Lokal beenden
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DemoWinnerPostPreview
        open={winnerOpen}
        onClose={() => setWinnerOpen(false)}
        onFinishTour={onWinnerContinue}
        onExploreFree={onExploreFree}
        primaryLabel="Chronik öffnen"
      />
    </>
  );
}
