import React from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import { formatDemoDate } from '../demoFixtures';
import {
  dsFeedCardShellClass,
  dsFeedCardGlowClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

const KIND_LABEL: Record<string, string> = {
  season_start: 'Saison',
  training: 'Training',
  schedule_change: 'Termin',
  squad: 'Kader',
  lineup: 'Aufstellung',
  result: 'Ergebnis',
  tournament_result: 'Turnier',
  challenge: 'Challenge',
  photo: 'Foto',
  next_training: 'Training',
};

export function DemoHomePage(): React.ReactElement {
  const { fixtures } = useDemo();
  const feed = [...fixtures.feed].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Übersicht</p>
        <h2 className={dsPageTitleClass()}>Saisonchronik</h2>
        <p className={dsSublineClass()}>
          Feed der Demo-Saison {fixtures.seasonLabel} – zusammenhängende Ereignisse derselben Mannschaft.
        </p>
      </header>

      <ul className="space-y-3">
        {feed.map((item) => (
          <li key={item.id} className={dsFeedCardShellClass()}>
            <div className={dsFeedCardGlowClass()} aria-hidden />
            <div className="relative z-10 space-y-2 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FF8A8A]">
                  {KIND_LABEL[item.kind] ?? 'Feed'}
                </span>
                <time className="text-[11px] text-white/45">{formatDemoDate(item.createdAt)}</time>
              </div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs leading-relaxed text-white/70">{item.body}</p>
              {item.kind === 'photo' ? (
                <div
                  className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/15 bg-gradient-to-br from-zinc-900 to-zinc-950 text-xs text-white/40"
                  aria-hidden
                >
                  Demo-Platzhalter Mannschaftsfoto
                </div>
              ) : null}
              {item.kind === 'next_training' ? (
                <Link
                  to="/demo/training"
                  className="inline-flex min-h-[40px] items-center text-xs font-semibold text-[#FF2D2D]"
                >
                  Training öffnen →
                </Link>
              ) : null}
              {item.kind === 'lineup' || item.kind === 'squad' ? (
                <Link
                  to="/demo/match"
                  className="inline-flex min-h-[40px] items-center text-xs font-semibold text-[#FF2D2D]"
                >
                  Aufstellung ansehen →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
