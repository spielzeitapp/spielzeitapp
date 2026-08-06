import React from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

const LINKS: { to: string; title: string; body: string }[] = [
  {
    to: '/demo/training',
    title: 'Training',
    body: 'Einheit „1 gegen 1 und schnelles Umschalten“',
  },
  {
    to: '/demo/match',
    title: 'Spiel / Aufstellung',
    body: 'Heimspiel vs. SV Loosdorf U12',
  },
  {
    to: '/demo/event',
    title: 'Event',
    body: 'U12-Teamabend und Saisonbesprechung',
  },
  {
    to: '/demo/turnier',
    title: 'Turniercenter',
    body: 'U12-Sommerturnier St. Veit',
  },
  {
    to: '/demo/live',
    title: 'LIVE-Ticker',
    body: 'Interaktiv, nur lokal im Browser',
  },
];

export function DemoMorePage(): React.ReactElement {
  const { fixtures, resetLive } = useDemo();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Mehr</p>
        <h2 className={dsPageTitleClass()}>Trainer-Bereiche</h2>
        <p className={dsSublineClass()}>
          Dieselbe Navigationsstruktur wie in der App – Detailbereiche über Mehr erreichbar.
        </p>
      </header>

      <ul className="space-y-2">
        {LINKS.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className={dsCardShellClass({ interactive: true, className: 'relative block' })}>
              <div className={dsCardAmbientGlowClass()} aria-hidden />
              <div className="relative z-10">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-white/60">{item.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className={dsCardShellClass({ className: 'relative' })}>
        <div className={dsCardAmbientGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-2 text-xs text-white/70">
          <p className="font-semibold text-white">Demo-Hinweise</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Team: {fixtures.teamName}</li>
            <li>Keine Registrierung, kein Login, keine echten Daten</li>
            <li>Reload stellt den LIVE-Ausgangszustand wieder her</li>
            <li>Push, E-Mail und DB-Schreibzugriffe sind abgeschaltet</li>
          </ul>
          <button
            type="button"
            onClick={resetLive}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white"
          >
            LIVE-Demo zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
