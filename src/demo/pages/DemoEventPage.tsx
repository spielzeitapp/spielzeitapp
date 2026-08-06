import React from 'react';
import { useDemo } from '../DemoContext';
import { formatDemoDate, formatDemoTime } from '../demoFixtures';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

export function DemoEventPage(): React.ReactElement {
  const { fixtures } = useDemo();
  const ev = fixtures.eventDetail;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Event</p>
        <h2 className={dsPageTitleClass()}>{ev.title}</h2>
        <p className={dsSublineClass()}>
          {formatDemoDate(ev.startsAt)} · {formatDemoTime(ev.startsAt)}
          {ev.endsAt ? ` – ${formatDemoTime(ev.endsAt)}` : ''}
        </p>
      </header>

      <div className={dsCardShellClass({ className: 'relative' })}>
        <div className={dsCardAmbientGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-3 text-sm text-white/80">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Ort</p>
            <p className="font-medium text-white">{ev.location}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
              Beschreibung
            </p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-white/75">
              {ev.notes}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">
              {ev.rsvpYes} Zusagen
            </span>
            <span className="rounded-md bg-rose-500/15 px-2 py-1 text-rose-300">
              {ev.rsvpNo} Absagen
            </span>
            <span className="rounded-md bg-white/10 px-2 py-1 text-white/70">
              {ev.rsvpOpen} offen
            </span>
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
        RSVP speichern und Eltern-Benachrichtigung – Demo (lokal, keine DB).
      </p>
    </div>
  );
}
