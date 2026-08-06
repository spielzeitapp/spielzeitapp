import React from 'react';
import { Link } from 'react-router-dom';
import { dsCardShellClass, dsCardAmbientGlowClass } from '../../lib/premiumDesignSystem';

const TOUR_STEPS: { title: string; body: string; to: string }[] = [
  {
    title: 'Termine und Rückmeldungen',
    body: 'Sieh Zusagen, Absagen und kommende Spiele auf einen Blick.',
    to: '/demo/termine',
  },
  {
    title: 'Kader und Aufstellung',
    body: 'Plane Mannschaftskader und Startelf für den Spieltag.',
    to: '/demo/team',
  },
  {
    title: 'Training vorbereiten',
    body: 'Öffne eine fertige Einheit mit Phasen, Material und Coachingpunkten.',
    to: '/demo/training',
  },
  {
    title: 'Turniere organisieren',
    body: 'Spielplan, Tabelle und Turnierkader im Turniercenter.',
    to: '/demo/turnier',
  },
  {
    title: 'Spiele LIVE begleiten',
    body: 'Ticker lokal ausprobieren – ohne echte Pushs oder Datenbank.',
    to: '/demo/live',
  },
];

type Props = {
  step: number;
  onNext: () => void;
  onSkip: () => void;
};

export function DemoTour({ step, onNext, onSkip }: Props): React.ReactElement {
  const item = TOUR_STEPS[Math.min(Math.max(step, 0), TOUR_STEPS.length - 1)]!;
  const isLast = step >= TOUR_STEPS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-40 flex justify-center px-3 sm:px-4">
      <div className={dsCardShellClass({ className: 'pointer-events-auto relative max-w-lg shadow-2xl' })}>
        <div className={dsCardAmbientGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Tour {step + 1}/{TOUR_STEPS.length}
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[36px] rounded-lg px-2 text-xs font-medium text-white/60 hover:text-white"
            >
              Überspringen
            </button>
          </div>
          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
          <p className="text-xs leading-relaxed text-white/70">{item.body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to={item.to}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white"
            >
              Bereich öffnen
            </Link>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex min-h-[40px] items-center rounded-xl bg-[#FF2D2D] px-3 text-xs font-semibold text-white"
            >
              {isLast ? 'Fertig' : 'Weiter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
