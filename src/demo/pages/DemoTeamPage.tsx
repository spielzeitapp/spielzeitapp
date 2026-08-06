import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import { playerLabel } from '../demoFixtures';
import type { DemoPlayerPosition } from '../demoTypes';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

const POS_ORDER: DemoPlayerPosition[] = ['TW', 'AV', 'IV', 'ZM', 'OM', 'ST'];

export function DemoTeamPage(): React.ReactElement {
  const { fixtures } = useDemo();
  const [filter, setFilter] = useState<'all' | DemoPlayerPosition>('all');
  const [view, setView] = useState<'squad' | 'matchday'>('squad');

  const matchdayIds = useMemo(
    () => new Set(fixtures.lineup.map((s) => s.playerId)),
    [fixtures.lineup],
  );

  const players = useMemo(() => {
    let list = [...fixtures.players];
    if (view === 'matchday') list = list.filter((p) => matchdayIds.has(p.id));
    if (filter !== 'all') list = list.filter((p) => p.position === filter);
    return list.sort((a, b) => POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position) || a.jersey - b.jersey);
  }, [fixtures.players, filter, view, matchdayIds]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Mannschaft</p>
        <h2 className={dsPageTitleClass()}>Kader</h2>
        <p className={dsSublineClass()}>
          15 fiktive U12-Spieler · neutrale Initialen · keine echten Kinderfotos.
        </p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('squad')}
          className={[
            'min-h-[40px] flex-1 rounded-xl text-xs font-semibold',
            view === 'squad' ? 'bg-[#FF2D2D] text-white' : 'bg-white/5 text-white/70',
          ].join(' ')}
        >
          Mannschaftskader
        </button>
        <button
          type="button"
          onClick={() => setView('matchday')}
          className={[
            'min-h-[40px] flex-1 rounded-xl text-xs font-semibold',
            view === 'matchday' ? 'bg-[#FF2D2D] text-white' : 'bg-white/5 text-white/70',
          ].join(' ')}
        >
          Spieltagskader
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', ...POS_ORDER] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilter(p)}
            className={[
              'min-h-[36px] rounded-lg px-2.5 text-[11px] font-semibold',
              filter === p ? 'bg-white text-black' : 'bg-white/5 text-white/65',
            ].join(' ')}
          >
            {p === 'all' ? 'Alle' : p}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id} className={dsCardShellClass({ className: 'relative !py-2.5 !px-3' })}>
            <div className={dsCardAmbientGlowClass()} aria-hidden />
            <div className="relative z-10 flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-900 text-xs font-bold text-white"
                aria-hidden
              >
                {p.firstName[0]}
                {p.lastInitial[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{playerLabel(p)}</p>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">
                    {p.position}
                  </span>
                  {!p.available ? (
                    <span className="text-[10px] font-semibold text-rose-300">fehlt</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-300">verfügbar</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-white/55">
                  Training {p.trainingPct}% · Einsätze {p.appearances} · Tore {p.goals}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link
        to="/demo/match"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white"
      >
        Zur Aufstellung
      </Link>
    </div>
  );
}
