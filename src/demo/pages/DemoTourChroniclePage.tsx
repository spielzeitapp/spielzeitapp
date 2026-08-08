import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../DemoContext';
import { DEMO_TOUR_STATIONS } from '../demoTourConfig';
import {
  advanceDemoTour,
  getDemoTourJourney,
  subscribeDemoTour,
} from '../demoTourState';
import { getDemoLiveRuntimeSnapshot } from '../demoLiveRuntime';

/**
 * Station 13 — lokale Chronik aus Journey + Seeds (keine Feed-Writes).
 */
export function DemoTourChroniclePage(): React.ReactElement {
  const navigate = useNavigate();
  const demo = useDemoMode();
  const [, bump] = useState(0);
  React.useEffect(() => subscribeDemoTour(() => bump((n) => n + 1)), []);

  const journey = getDemoTourJourney();
  const live = getDemoLiveRuntimeSnapshot();

  const entries = useMemo(() => {
    const list: { title: string; detail: string }[] = [];
    if (journey.localTraining) {
      list.push({
        title: 'Training angelegt',
        detail: `${journey.localTraining.location} · ${journey.localTraining.focus || 'Schwerpunkt offen'}`,
      });
    }
    if (journey.trainingNoahStatus) {
      list.push({
        title: 'Elternantwort Training',
        detail: journey.trainingNoahStatus === 'yes' ? 'Noah: Dabei' : 'Noah: Absage',
      });
    }
    if (journey.localMatchReady) {
      list.push({
        title: 'Spiel Loosdorf',
        detail: 'Meisterschaftstermin zentral für das Team vorbereitet',
      });
    }
    if (journey.matchNoahStatus) {
      list.push({
        title: 'Elternantwort Spiel',
        detail: journey.matchNoahStatus === 'yes' ? 'Noah: Dabei' : 'Noah: Absage',
      });
    }
    list.push({
      title: 'Matchkader & Aufstellung',
      detail: '12 Spieler · Formation 1-3-3-1 · lokal in der Demo',
    });
    if (live) {
      list.push({
        title: 'LIVE / Ergebnis',
        detail: `Stand ${live.scoreHome}:${live.scoreAway} · Status ${live.status}`,
      });
    }
    list.push({
      title: 'Siegerpost',
      detail: 'Nur Demo-Vorschau – wird nicht veröffentlicht',
    });
    for (const note of journey.chronicleNotes) {
      if (!list.some((e) => e.detail.includes(note) || e.title.includes(note))) {
        list.push({ title: 'Demo-Moment', detail: note });
      }
    }
    if (list.length === 0) {
      list.push({
        title: 'Demo-Chronik',
        detail: 'Noch keine Journey-Schritte – Seeds bleiben sichtbar nach Reload der Tour.',
      });
    }
    return list;
  }, [journey, live, demo?.liveRuntimeVersion]);

  const continueTour = () => {
    const next = advanceDemoTour();
    const station = DEMO_TOUR_STATIONS[next.stepIndex];
    if (next.phase === 'active' && station) navigate(station.path);
    else if (next.phase === 'finished') navigate(DEMO_TOUR_STATIONS[DEMO_TOUR_STATIONS.length - 1].path);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-1 pb-28 pt-2">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
          Demo-Vorschau
        </p>
        <h1 className="text-[20px] font-bold text-white">Chronik</h1>
        <p className="text-[13px] text-white/60">
          Deine Demo-Session bleibt beim Reload erhalten – ohne Cloud und ohne Veröffentlichung.
        </p>
      </header>

      <ul className="space-y-2">
        {entries.map((e, i) => (
          <li
            key={`${e.title}-${i}`}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
          >
            <p className="text-[13px] font-semibold text-white">{e.title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/60">{e.detail}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={continueTour}
        className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
      >
        Saisonbilanz ansehen
      </button>
      <button
        type="button"
        onClick={() => navigate('/demo/home')}
        className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
      >
        Zur Demo-Home
      </button>
    </div>
  );
}
