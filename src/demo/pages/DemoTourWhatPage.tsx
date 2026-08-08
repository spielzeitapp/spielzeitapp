import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  DEMO_TOUR_STATIONS,
  DEMO_TOUR_WHAT_POINTS,
  DEMO_TOUR_WHAT_TAGLINE,
} from '../demoTourConfig';
import { startDemoTour } from '../demoTourState';

/**
 * WHAT-Übersicht vor dem HOW-Rundgang (nicht Teil der 14 Stationen).
 */
export function DemoTourWhatPage(): React.ReactElement {
  const navigate = useNavigate();

  const startHow = () => {
    startDemoTour();
    navigate(DEMO_TOUR_STATIONS[0]?.path ?? '/demo/home', { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-1 pb-28 pt-2">
      <header className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/90">
          Was wird organisiert?
        </p>
        <h1 className="text-[22px] font-bold leading-tight text-white sm:text-[24px]">
          Der komplette Traineralltag an einem Ort
        </h1>
        <p className="text-[13px] leading-snug text-white/65">{DEMO_TOUR_WHAT_TAGLINE}</p>
      </header>

      <ul className="space-y-2.5">
        {DEMO_TOUR_WHAT_POINTS.map((point) => (
          <li
            key={point}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="text-[13px] font-medium leading-snug text-white/85">{point}</span>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[11px] leading-snug text-white/45">
        Kein Login erforderlich. Alle Änderungen bleiben lokal in dieser Demo.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={startHow}
          className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
        >
          Rundgang starten
        </button>
        <button
          type="button"
          onClick={() => navigate('/demo/home')}
          className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
        >
          Demo frei erkunden
        </button>
      </div>
    </div>
  );
}
