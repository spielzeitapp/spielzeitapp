import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../DemoContext';
import { DEMO_TEAM_SEASON_ID, toDemoEventRow } from '../demoDataSource';
import {
  DEMO_TOUR_LOCAL_TRAINING_ID,
  DEMO_TOUR_STATIONS,
} from '../demoTourConfig';
import {
  advanceDemoTour,
  appendDemoChronicleNote,
  getDemoTourJourney,
  patchDemoTourJourney,
  subscribeDemoTour,
} from '../demoTourState';
import { demoOffsetIso } from '../demoTime';
import { DEMO_TOUR_PRIMARY_EVENT } from '../demoTourActions';

function defaultDateValue(): string {
  // demoOffsetIso(+3) als lokales YYYY-MM-DD fürs Formular
  const iso = demoOffsetIso(3, 17, 0);
  return iso.slice(0, 10);
}

/**
 * Station 1 — lokales Training anlegen (keine Supabase-Writes).
 */
export function DemoTourCreateTrainingPage(): React.ReactElement {
  const navigate = useNavigate();
  const demo = useDemoMode();
  const [date, setDate] = useState(defaultDateValue);
  const [time, setTime] = useState('17:00');
  const [location, setLocation] = useState('Sportplatz Rohrbach');
  const [focus, setFocus] = useState('1 gegen 1 und schnelles Umschalten');
  const [saved, setSaved] = useState(() => Boolean(getDemoTourJourney().localTraining));
  const [, bump] = useState(0);

  React.useEffect(() => subscribeDemoTour(() => bump((n) => n + 1)), []);

  const journeyTraining = getDemoTourJourney().localTraining;

  const startsAtPreview = useMemo(() => {
    const [h, m] = time.split(':').map((x) => Number(x) || 0);
    return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`;
  }, [date, time]);

  const save = React.useCallback(() => {
    const training = {
      id: DEMO_TOUR_LOCAL_TRAINING_ID,
      title: 'Training',
      startsAt: startsAtPreview,
      location: location.trim() || 'Sportplatz Rohrbach',
      focus: focus.trim(),
    };
    patchDemoTourJourney({ localTraining: training });
    appendDemoChronicleNote(`Training angelegt · ${training.location} · Schwerpunkt ${training.focus || '—'}`);

    demo?.addDemoLocalEvent?.(
      toDemoEventRow({
        id: DEMO_TOUR_LOCAL_TRAINING_ID,
        kind: 'training',
        starts_at: startsAtPreview,
        meeting_at: null,
        location: training.location,
        notes: training.focus
          ? `Demo – lokal · Schwerpunkt: ${training.focus}`
          : 'Demo – lokal angelegtes Training',
        status: 'upcoming',
        team_season_id: DEMO_TEAM_SEASON_ID,
      }),
    );

    setSaved(true);
    const next = advanceDemoTour();
    const station = DEMO_TOUR_STATIONS[next.stepIndex];
    if (next.phase === 'active' && station) navigate(station.path);
  }, [demo, focus, location, navigate, startsAtPreview]);

  React.useEffect(() => {
    const onPrimary = () => {
      if (!getDemoTourJourney().localTraining) save();
    };
    window.addEventListener(DEMO_TOUR_PRIMARY_EVENT, onPrimary);
    return () => window.removeEventListener(DEMO_TOUR_PRIMARY_EVENT, onPrimary);
  }, [save]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-1 pb-28 pt-2">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
          Demo – lokal
        </p>
        <h1 className="text-[20px] font-bold text-white">Training anlegen</h1>
        <p className="text-[13px] text-white/60">
          Nur in dieser Demo-Session. Keine echten Nachrichten, kein Cloud-Speicher.
        </p>
      </header>

      <form
        className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Datum
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Uhrzeit
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Treffpunkt / Ort
          </span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Trainingsschwerpunkt
          </span>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white"
          />
        </label>

        {journeyTraining || saved ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
            Gespeichert in der Demo-Session
            {journeyTraining ? ` · ${journeyTraining.location}` : ''}.
          </p>
        ) : null}

        <button
          type="submit"
          className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
        >
          Training speichern
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate('/demo/home')}
        className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
      >
        Abbrechen
      </button>
    </div>
  );
}
