import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import type { AttendanceStatus } from '../../hooks/useEventsAttendance';
import { useDemoMode } from '../DemoContext';
import { DEMO_SELF_PLAYER_ID, getDemoFixturePlayer } from '../demoPlayers';
import {
  DEMO_LOOSDORF_EVENT_ID,
  DEMO_TOUR_LOCAL_TRAINING_ID,
  DEMO_TOUR_STATIONS,
  DEMO_TRAINING_EVENT_ID,
} from '../demoTourConfig';
import {
  advanceDemoTour,
  appendDemoChronicleNote,
  getDemoTourJourney,
  patchDemoTourJourney,
  subscribeDemoTour,
} from '../demoTourState';
import { DEMO_TOUR_PRIMARY_EVENT } from '../demoTourActions';

type RsvpMode = 'training' | 'match';

const DECLINE_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: 'no', label: 'Absage' },
  { status: 'sick', label: 'Krank' },
  { status: 'injured', label: 'Verletzt' },
  { status: 'external_training', label: 'Externes Training' },
];

function resolveMode(pathname: string, search: string): RsvpMode {
  if (pathname.includes('parent-match')) return 'match';
  if (pathname.includes('parent-training')) return 'training';
  const q = new URLSearchParams(search).get('mode');
  return q === 'match' ? 'match' : 'training';
}

/**
 * Station 2 / 6 — lokale Elternvorschau für Noah (p08).
 */
export function DemoTourParentRsvpPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const demo = useDemoMode();
  const mode = resolveMode(location.pathname, location.search);
  const [, bump] = useState(0);
  const [showDecline, setShowDecline] = useState(false);
  React.useEffect(() => subscribeDemoTour(() => bump((n) => n + 1)), []);

  const journey = getDemoTourJourney();
  const noah = getDemoFixturePlayer(DEMO_SELF_PLAYER_ID);
  const name = noah ? `${noah.firstName} ${noah.lastInitial}` : 'Noah K.';

  const eventId = useMemo(() => {
    if (mode === 'match') return DEMO_LOOSDORF_EVENT_ID;
    return journey.localTraining?.id ?? DEMO_TOUR_LOCAL_TRAINING_ID;
  }, [mode, journey.localTraining?.id]);

  const current =
    mode === 'match' ? journey.matchNoahStatus : journey.trainingNoahStatus;

  const eventLabel =
    mode === 'match'
      ? 'Meisterschaft vs. SV Loosdorf U12'
      : journey.localTraining
        ? `Training · ${journey.localTraining.location}`
        : 'Nächstes Training';

  const apply = React.useCallback(
    (status: AttendanceStatus) => {
      const journeyYesNo: 'yes' | 'no' = status === 'yes' ? 'yes' : 'no';
      if (mode === 'match') {
        patchDemoTourJourney({ matchNoahStatus: journeyYesNo });
        demo?.setDemoAttendance(DEMO_LOOSDORF_EVENT_ID, DEMO_SELF_PLAYER_ID, status);
        appendDemoChronicleNote(
          journeyYesNo === 'yes'
            ? 'Noah: Dabei beim Loosdorf-Spiel'
            : `Noah: Absage zum Loosdorf-Spiel (${DECLINE_OPTIONS.find((d) => d.status === status)?.label ?? 'Absage'})`,
        );
      } else {
        patchDemoTourJourney({ trainingNoahStatus: journeyYesNo });
        demo?.setDemoAttendance(eventId, DEMO_SELF_PLAYER_ID, status);
        if (eventId !== DEMO_TRAINING_EVENT_ID) {
          demo?.setDemoAttendance(DEMO_TRAINING_EVENT_ID, DEMO_SELF_PLAYER_ID, status);
        }
        appendDemoChronicleNote(
          journeyYesNo === 'yes'
            ? 'Noah: Dabei beim Training'
            : `Noah: Absage zum Training (${DECLINE_OPTIONS.find((d) => d.status === status)?.label ?? 'Absage'})`,
        );
      }

      const next = advanceDemoTour();
      const station = DEMO_TOUR_STATIONS[next.stepIndex];
      if (next.phase === 'active' && station) navigate(station.path);
    },
    [demo, eventId, mode, navigate],
  );

  React.useEffect(() => {
    const onPrimary = () => {
      const j = getDemoTourJourney();
      const done = mode === 'match' ? j.matchNoahStatus : j.trainingNoahStatus;
      if (!done) apply('yes');
    };
    window.addEventListener(DEMO_TOUR_PRIMARY_EVENT, onPrimary);
    return () => window.removeEventListener(DEMO_TOUR_PRIMARY_EVENT, onPrimary);
  }, [apply, mode]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-1 pb-28 pt-2">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
          Elternvorschau · Demo – lokal
        </p>
        <h1 className="text-[20px] font-bold text-white">
          {mode === 'match' ? 'Rückmeldung zum Spiel' : 'Rückmeldung zum Training'}
        </h1>
        <p className="text-[13px] text-white/60">{eventLabel}</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Spieler</p>
        <p className="mt-1 text-[17px] font-semibold text-white">{name}</p>
        <p className="mt-0.5 text-[12px] text-white/50">
          Trikot {noah?.jersey ?? 10} · OM · Trainingsquote 93 %
        </p>
        {current ? (
          <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
            Aktuell:{' '}
            <span className={current === 'yes' ? 'text-emerald-300' : 'text-rose-300'}>
              {current === 'yes' ? 'Dabei' : 'Absage'}
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => apply('yes')}
          className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
        >
          👍 Dabei
        </button>
        {!showDecline ? (
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            className={`${dsSecondaryCtaClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
          >
            Absage
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
              Absagegrund
            </p>
            {DECLINE_OPTIONS.map((opt) => (
              <button
                key={opt.status}
                type="button"
                onClick={() => apply(opt.status)}
                className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-snug text-white/40">
        Nur lokale Demo-Antwort. Es wird keine Nachricht an Eltern oder Trainer gesendet.
      </p>
    </div>
  );
}
