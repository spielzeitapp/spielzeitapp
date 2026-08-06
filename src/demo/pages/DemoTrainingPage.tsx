import React from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import { formatDemoDate, formatDemoTime } from '../demoFixtures';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
  dsTrainingAttendanceCardGlowClass,
  dsTrainingAttendanceCardShellClass,
} from '../../lib/premiumDesignSystem';

export function DemoTrainingPage(): React.ReactElement {
  const { fixtures } = useDemo();
  const tr = fixtures.training;
  const event = fixtures.events.find((e) => e.id === tr.eventId);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Training</p>
        <h2 className={dsPageTitleClass()}>{tr.title}</h2>
        <p className={dsSublineClass()}>
          {tr.durationMin} Minuten · Status: {tr.status}
          {event
            ? ` · Termin ${formatDemoDate(event.startsAt)} ${formatDemoTime(event.startsAt)}`
            : null}
        </p>
      </header>

      <div className={dsTrainingAttendanceCardShellClass()}>
        <div className={dsTrainingAttendanceCardGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-2">
          <p className="text-xs font-semibold text-white">Anwesenheit</p>
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">
              {tr.present} anwesend
            </span>
            <span className="rounded-md bg-rose-500/15 px-2 py-1 text-rose-300">
              {tr.absent} abwesend
            </span>
          </div>
          <p className="text-xs leading-relaxed text-white/70">
            <span className="font-semibold text-white/90">Trainer-Notiz: </span>
            {tr.note}
          </p>
          {event ? (
            <Link to="/demo/termine" className="inline-flex min-h-[36px] items-center text-xs font-semibold text-[#FF2D2D]">
              Zum Trainingstermin →
            </Link>
          ) : null}
        </div>
      </div>

      <ul className="space-y-3">
        {tr.parts.map((part) => (
          <li key={part.id} className={dsCardShellClass({ className: 'relative' })}>
            <div className={dsCardAmbientGlowClass()} aria-hidden />
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#FF8A8A]">
                  {part.phase} · {part.minutes} Min.
                </p>
              </div>
              <h3 className="text-sm font-semibold text-white">{part.title}</h3>
              <dl className="space-y-1.5 text-xs text-white/70">
                <div>
                  <dt className="font-semibold text-white/90">Organisation</dt>
                  <dd>{part.organization}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white/90">Ziel</dt>
                  <dd>{part.goal}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white/90">Material</dt>
                  <dd>{part.material}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white/90">Coachingpunkte</dt>
                  <dd>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {part.coaching.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              <div
                className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/15 bg-zinc-950/80 text-[11px] text-white/40"
                aria-hidden
              >
                Demo-Skizze / Platzhalter
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
        Schreibende Aktionen (Übung speichern, Anwesenheit sync) sind in der Demo deaktiviert.
      </p>
    </div>
  );
}
