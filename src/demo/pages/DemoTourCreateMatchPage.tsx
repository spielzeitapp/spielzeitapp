import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../DemoContext';
import {
  DEMO_LOOSDORF_EVENT_ID,
  DEMO_TOUR_STATIONS,
} from '../demoTourConfig';
import {
  advanceDemoTour,
  appendDemoChronicleNote,
  getDemoTourJourney,
  patchDemoTourJourney,
  subscribeDemoTour,
} from '../demoTourState';
import { formatDemoDate, formatDemoTime } from '../demoFixtures';
import { DEMO_TOUR_PRIMARY_EVENT } from '../demoTourActions';

/**
 * Station 5 — Loosdorf-Spiel in der Journey als „angelegt“ markieren (Fixture bleibt geschützt).
 */
export function DemoTourCreateMatchPage(): React.ReactElement {
  const navigate = useNavigate();
  const demo = useDemoMode();
  const [, bump] = useState(0);
  React.useEffect(() => subscribeDemoTour(() => bump((n) => n + 1)), []);

  const loosdorf =
    demo?.fixtures.events.find((e) => e.id === DEMO_LOOSDORF_EVENT_ID) ??
    demo?.data.events.find((e) => e.id === DEMO_LOOSDORF_EVENT_ID) ??
    null;

  const ready = getDemoTourJourney().localMatchReady;

  const opponent = loosdorf && 'opponent' in loosdorf
    ? (loosdorf as { opponent?: string | null }).opponent ?? 'SV Loosdorf U12'
    : 'SV Loosdorf U12';
  const location =
    (loosdorf && 'location' in loosdorf ? loosdorf.location : null) ?? 'Sportplatz Rohrbach';
  const startsAt =
    (loosdorf && 'startsAt' in loosdorf
      ? (loosdorf as { startsAt: string }).startsAt
      : (loosdorf as { starts_at?: string } | null)?.starts_at) ?? '';
  const meetingAt =
    (loosdorf && 'meetingAt' in loosdorf
      ? (loosdorf as { meetingAt?: string | null }).meetingAt
      : (loosdorf as { meeting_at?: string | null } | null)?.meeting_at) ?? null;

  const save = React.useCallback(() => {
    patchDemoTourJourney({ localMatchReady: true });
    appendDemoChronicleNote(`Spiel angelegt · ${opponent} · ${location}`);
    const next = advanceDemoTour();
    const station = DEMO_TOUR_STATIONS[next.stepIndex];
    if (next.phase === 'active' && station) navigate(station.path);
  }, [location, navigate, opponent]);

  React.useEffect(() => {
    const onPrimary = () => {
      if (!getDemoTourJourney().localMatchReady) save();
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
        <h1 className="text-[20px] font-bold text-white">Spiel anlegen</h1>
        <p className="text-[13px] text-white/60">
          Vorbereitetes Heimspiel gegen Loosdorf – nur in der Demo-Session bestätigen.
        </p>
      </header>

      <dl className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[13px]">
        <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
          <dt className="text-white/45">Gegner</dt>
          <dd className="text-right font-medium text-white/90">{opponent}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
          <dt className="text-white/45">Datum</dt>
          <dd className="text-right font-medium text-white/90">
            {startsAt ? formatDemoDate(startsAt) : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
          <dt className="text-white/45">Beginn</dt>
          <dd className="text-right font-medium text-white/90">
            {startsAt ? `${formatDemoTime(startsAt)} Uhr` : '10:30 Uhr'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
          <dt className="text-white/45">Treffpunkt</dt>
          <dd className="text-right font-medium text-white/90">
            {meetingAt ? `${formatDemoTime(meetingAt)} Uhr` : '09:45 Uhr'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-1.5">
          <dt className="text-white/45">Spielort</dt>
          <dd className="text-right font-medium text-white/90">{location}</dd>
        </div>
      </dl>

      {ready ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
          Spiel ist in der Demo-Journey als angelegt markiert.
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
      >
        Spiel speichern
      </button>
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
