import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../DemoContext';
import { formatDemoDate, formatDemoTime, playerLabel } from '../demoFixtures';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

/** Einfache Feldvisualisierung – an vorhandene Formation 2-3-1 angelehnt. */
function PitchFormation({
  labels,
}: {
  labels: { id: string; name: string; pos: string }[];
}): React.ReactElement {
  const rows: { id: string; name: string; pos: string }[][] = [[], [], [], []];
  for (const s of labels) {
    if (s.pos === 'TW') rows[0]!.push(s);
    else if (s.pos === 'AV' || s.pos === 'IV') rows[1]!.push(s);
    else if (s.pos === 'ZM' || s.pos === 'OM') rows[2]!.push(s);
    else rows[3]!.push(s);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[linear-gradient(180deg,#0f3d24_0%,#0a2a18_100%)] p-3">
      <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-white/15" aria-hidden />
      <div className="flex flex-col gap-4 py-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-wrap items-center justify-center gap-2">
            {row.map((p) => (
              <div
                key={p.id}
                className="flex min-w-[72px] flex-col items-center rounded-xl border border-white/20 bg-black/45 px-2 py-1.5 text-center"
              >
                <span className="text-[9px] font-bold uppercase text-white/50">{p.pos}</span>
                <span className="text-[11px] font-semibold text-white">{p.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoMatchPage(): React.ReactElement {
  const { fixtures } = useDemo();
  const game = fixtures.events.find((e) => e.id === 'ev-game-next')!;
  const byId = useMemo(
    () => new Map(fixtures.players.map((p) => [p.id, p])),
    [fixtures.players],
  );

  const starters = fixtures.lineup
    .filter((s) => s.role === 'start')
    .map((s) => {
      const p = byId.get(s.playerId)!;
      return {
        id: s.playerId,
        name: `${p.firstName} ${p.lastInitial}`,
        pos: s.positionLabel,
        full: playerLabel(p),
      };
    });

  const bench = fixtures.lineup
    .filter((s) => s.role === 'bench')
    .map((s) => {
      const p = byId.get(s.playerId)!;
      return { id: s.playerId, label: playerLabel(p), pos: s.positionLabel };
    });

  const available = fixtures.players.filter((p) => p.available);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>Spiel & Aufstellung</p>
        <h2 className={dsPageTitleClass()}>
          NSG Rohrbach U12 – {game.opponent}
        </h2>
        <p className={dsSublineClass()}>
          {formatDemoDate(game.startsAt)} · {formatDemoTime(game.startsAt)} ·{' '}
          {game.isHome ? 'Heim' : 'Auswärts'} · {game.location}
        </p>
      </header>

      <div className={dsCardShellClass({ matchday: true, className: 'relative' })}>
        <div className={dsCardAmbientGlowClass(true)} aria-hidden />
        <div className="relative z-10 space-y-2 text-xs text-white/75">
          <p>
            <span className="font-semibold text-white">Zusagen:</span> {game.rsvpYes} · Absagen:{' '}
            {game.rsvpNo} · offen: {game.rsvpOpen}
          </p>
          <p>
            Treffpunkt:{' '}
            {game.meetingAt
              ? `${formatDemoTime(game.meetingAt)} am Platz`
              : 'wie gewohnt'}
          </p>
          <p>
            Formation: <span className="font-semibold text-white">{fixtures.formation}</span>
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Startaufstellung</h3>
        <PitchFormation labels={starters} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Ersatzspieler</h3>
        <ul className="space-y-1.5">
          {bench.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="font-medium text-white">{b.label}</span>
              <span className="text-white/50">{b.pos}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Verfügbarer Kader</h3>
        <p className="text-xs text-white/55">{available.length} Spieler verfügbar</p>
        <div className="flex flex-wrap gap-1.5">
          {available.map((p) => (
            <span
              key={p.id}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/80"
            >
              {playerLabel(p)}
            </span>
          ))}
        </div>
      </section>

      <section className={dsCardShellClass({ className: 'relative' })}>
        <div className={dsCardAmbientGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-1">
          <h3 className="text-sm font-semibold text-white">Spielzeitübersicht (Demo)</h3>
          <p className="text-xs text-white/65">
            Geplante Spielzeit: 2 × 35 Min. · Wechsel frei · Fair-Play-Regel beachten.
          </p>
          <Link to="/demo/live" className="inline-flex min-h-[40px] items-center text-xs font-semibold text-[#FF2D2D]">
            LIVE-Ticker öffnen →
          </Link>
        </div>
      </section>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
        Aufstellung speichern / Push an Eltern – in der Demo deaktiviert.
      </p>
    </div>
  );
}
