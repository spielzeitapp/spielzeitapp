import React, { useMemo, useState } from 'react';
import { useDemo } from '../DemoContext';
import { formatDemoTime, playerLabel } from '../demoFixtures';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

type Tab = 'spielplan' | 'tabelle' | 'kader';

export function DemoTournamentPage(): React.ReactElement {
  const { fixtures } = useDemo();
  const [tab, setTab] = useState<Tab>('spielplan');
  const t = fixtures.tournament;
  const byId = useMemo(
    () => new Map(fixtures.players.map((p) => [p.id, p])),
    [fixtures.players],
  );

  const table = [...t.teams].sort(
    (a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
  );

  const nextMatch = t.matches.find((m) => m.scoreHome == null);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Turniercenter</p>
        <h2 className={dsPageTitleClass()}>{t.name}</h2>
        <p className={dsSublineClass()}>{t.location}</p>
      </header>

      {nextMatch ? (
        <div className={dsCardShellClass({ matchday: true, className: 'relative' })}>
          <div className={dsCardAmbientGlowClass(true)} aria-hidden />
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF8A8A]">
              Nächstes Spiel
            </p>
            <p className="text-sm font-semibold text-white">
              {nextMatch.home} – {nextMatch.away}
            </p>
            <p className="text-xs text-white/60">{formatDemoTime(nextMatch.kickoff)} · Finale</p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(
          [
            ['spielplan', 'Spielplan'],
            ['tabelle', 'Tabelle'],
            ['kader', 'Kader'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'min-h-[40px] flex-1 rounded-lg text-xs font-semibold',
              tab === id ? 'bg-[#FF2D2D] text-white' : 'text-white/65',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'spielplan' ? (
        <ul className="space-y-2">
          {t.matches.map((m) => (
            <li key={m.id} className={dsCardShellClass({ className: 'relative !py-2.5' })}>
              <div className={dsCardAmbientGlowClass()} aria-hidden />
              <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {m.home} – {m.away}
                  </p>
                  <p className="text-white/50">{formatDemoTime(m.kickoff)}</p>
                </div>
                <div className="shrink-0 text-sm font-bold tabular-nums text-white">
                  {m.scoreHome != null && m.scoreAway != null
                    ? `${m.scoreHome}:${m.scoreAway}`
                    : '–:–'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'tabelle' ? (
        <div className={dsCardShellClass({ className: 'relative overflow-x-auto !px-0' })}>
          <div className={dsCardAmbientGlowClass()} aria-hidden />
          <table className="relative z-10 w-full min-w-[320px] text-left text-xs">
            <thead className="text-white/45">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-1 py-2 font-medium">Sp</th>
                <th className="px-1 py-2 font-medium">S</th>
                <th className="px-1 py-2 font-medium">U</th>
                <th className="px-1 py-2 font-medium">N</th>
                <th className="px-1 py-2 font-medium">Tore</th>
                <th className="px-3 py-2 font-medium">Pkt</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.id} className="border-b border-white/5 text-white/85">
                  <td className="max-w-[140px] truncate px-3 py-2 font-medium text-white">
                    {i + 1}. {row.name.replace(' – Demo', '')}
                  </td>
                  <td className="px-1 py-2">{row.played}</td>
                  <td className="px-1 py-2">{row.won}</td>
                  <td className="px-1 py-2">{row.draw}</td>
                  <td className="px-1 py-2">{row.lost}</td>
                  <td className="px-1 py-2 tabular-nums">
                    {row.gf}:{row.ga}
                  </td>
                  <td className="px-3 py-2 font-bold text-white">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'kader' ? (
        <ul className="space-y-1.5">
          {t.squadPlayerIds.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <li
                key={id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <span className="font-medium text-white">{playerLabel(p)}</span>
                <span className="text-white/50">{p.position}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
