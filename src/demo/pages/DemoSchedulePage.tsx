import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import { formatDemoDate, formatDemoTime } from '../demoFixtures';
import type { DemoEvent } from '../demoTypes';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

const KIND_LABEL: Record<DemoEvent['kind'], string> = {
  training: 'Training',
  game: 'Meisterschaft',
  tournament: 'Turnier',
  event: 'Teamevent',
  info: 'Elterninfo',
};

function EventCard({ event }: { event: DemoEvent }): React.ReactElement {
  const detailTo =
    event.kind === 'training' && event.linkedTrainingId
      ? '/demo/training'
      : event.kind === 'game'
        ? '/demo/match'
        : event.kind === 'tournament'
          ? '/demo/turnier'
          : event.kind === 'event'
            ? '/demo/event'
            : null;

  return (
    <article className={dsCardShellClass({ matchday: event.kind === 'game', className: 'relative' })}>
      <div className={dsCardAmbientGlowClass(event.kind === 'game')} aria-hidden />
      <div className="relative z-10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF8A8A]">
              {KIND_LABEL[event.kind]}
            </p>
            <h3 className="text-sm font-semibold text-white">{event.title}</h3>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1 text-center">
            <div className="text-[10px] uppercase text-white/50">
              {formatDemoDate(event.startsAt).split(',')[0]}
            </div>
            <div className="text-sm font-bold text-white">{formatDemoTime(event.startsAt)}</div>
          </div>
        </div>

        <p className="text-xs text-white/65">
          {formatDemoDate(event.startsAt)} · {event.location}
        </p>

        {event.opponent ? (
          <p className="text-sm font-medium text-white">
            vs. {event.opponent}
            {event.isHome != null ? (
              <span className="ml-2 text-xs font-normal text-white/55">
                ({event.isHome ? 'Heim' : 'Auswärts'})
              </span>
            ) : null}
          </p>
        ) : null}

        {event.notes ? <p className="text-xs text-white/55">{event.notes}</p> : null}

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">
            {event.rsvpYes} Zusagen
          </span>
          <span className="rounded-md bg-rose-500/15 px-2 py-1 text-rose-300">
            {event.rsvpNo} Absagen
          </span>
          <span className="rounded-md bg-white/10 px-2 py-1 text-white/70">
            {event.rsvpOpen} offen
          </span>
        </div>

        {event.kind === 'game' && detailTo ? (
          <Link
            to={detailTo}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#FF2D2D] px-4 text-xs font-semibold text-white"
          >
            Kader festlegen
          </Link>
        ) : null}

        {event.kind === 'training' && detailTo ? (
          <Link
            to={detailTo}
            className="inline-flex min-h-[40px] items-center text-xs font-semibold text-[#FF2D2D]"
          >
            Trainingseinheit öffnen →
          </Link>
        ) : null}

        {event.kind !== 'game' && event.kind !== 'training' && detailTo ? (
          <Link
            to={detailTo}
            className="inline-flex min-h-[40px] items-center text-xs font-semibold text-[#FF2D2D]"
          >
            Details →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function DemoSchedulePage(): React.ReactElement {
  const { fixtures } = useDemo();
  const sorted = useMemo(
    () =>
      [...fixtures.events].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    [fixtures.events],
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Termine</p>
        <h2 className={dsPageTitleClass()}>Saison {fixtures.seasonLabel}</h2>
        <p className={dsSublineClass()}>
          Aktive Saison standardmäßig ausgewählt. Training, Spiele, Turnier und Events.
        </p>
      </header>

      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
        <span className="rounded-lg bg-[#FF2D2D] px-3 py-1.5 font-semibold text-white">
          {fixtures.seasonLabel}
        </span>
        <span className="px-3 py-1.5 text-white/40">2025/26</span>
      </div>

      <ul className="space-y-3">
        {sorted.map((ev) => (
          <li key={ev.id}>
            <EventCard event={ev} />
          </li>
        ))}
      </ul>
    </div>
  );
}
