import React, { useState } from 'react';
import { PitchPlayerMarker } from '../../components/match/PitchPlayerMarker';
import type { PlayerItem } from '../../hooks/usePlayers';

export const DEMO_FORMATION_SYSTEMS = {
  '9': ['3-3-2', '3-2-3', '4-3-1'],
  '11': ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'],
} as const;

type Position = { x: number; y: number; label: string };
const line = (y: number, labels: string[], xs: number[]): Position[] => labels.map((label, i) => ({ x: xs[i], y, label }));
const keeper = line(88, ['TW'], [50]);
const backFour = [...line(69, ['LV', 'RV'], [16, 84]), ...line(72, ['IV', 'IV'], [39, 61])];
const backThree = line(71, ['LIV', 'IV', 'RIV'], [25, 50, 75]);
const pair = line(19, ['ST', 'ST'], [38, 62]);

// Schematic base positions, attacking upwards. Sources: England Football Learning
// (9v9) and Coaches' Voice (4-4-2, 4-3-3, 4-2-3-1, 3-5-2).
// Explicit role coordinates preserve central pairs, pivots and wide players.
export const DEMO_FORMATION_LAYOUTS: Record<string, Position[]> = {
  '3-3-2': [...keeper, ...backThree, ...line(45, ['LM', 'ZM', 'RM'], [19, 50, 81]), ...pair],
  '3-2-3': [...keeper, ...backThree, ...line(48, ['ZM', 'ZM'], [37, 63]), ...line(22, ['LF', 'ST', 'RF'], [19, 50, 81])],
  '4-3-1': [...keeper, ...backFour, ...line(43, ['LM', 'ZM', 'RM'], [22, 50, 78]), ...line(18, ['ST'], [50])],
  '4-4-2': [...keeper, ...backFour, ...line(44, ['LM', 'ZM', 'ZM', 'RM'], [16, 39, 61, 84]), ...pair],
  '4-3-3': [...keeper, ...backFour, ...line(53, ['DM'], [50]), ...line(36, ['ZM', 'ZM'], [34, 66]), ...line(17, ['LF', 'ST', 'RF'], [18, 50, 82])],
  '4-2-3-1': [...keeper, ...backFour, ...line(53, ['DM', 'DM'], [37, 63]), ...line(35, ['LM', 'OM', 'RM'], [18, 50, 82]), ...line(16, ['ST'], [50])],
  '3-5-2': [...keeper, ...backThree, ...line(51, ['LAV', 'RAV'], [15, 85]), ...line(56, ['DM'], [50]), ...line(35, ['ZM', 'ZM'], [35, 65]), ...pair],
};

function playerName(player: PlayerItem): string {
  return player.display_name?.trim() || [player.first_name, player.last_name].filter(Boolean).join(' ').trim() || 'Spieler';
}

type Format = '7' | keyof typeof DEMO_FORMATION_SYSTEMS;

/** Local preview only: never changes the live engine or a saved lineup. */
export function DemoFormationPreview({ players, format, onFormatChange }: {
  players: PlayerItem[];
  format: Format;
  onFormatChange: (format: Format) => void;
}): React.ReactElement {
  const [systems, setSystems] = useState({ '9': '3-3-2', '11': '4-4-2' });
  const system = format === '7' ? '' : systems[format];
  const starters = players.slice(0, Number(format));
  const bench = players.slice(Number(format));
  const positions = format === '7' ? [] : DEMO_FORMATION_LAYOUTS[system].map((position, index) => ({
    ...position, player: starters[index],
  }));
  return <section className="space-y-3 py-3" aria-label="Demo-Spielformat">
    <label className="block text-xs font-semibold text-white/70">
      Spielformat in der Demo
      <select value={format} onChange={event => onFormatChange(event.target.value as Format)}
        className="mt-1 min-h-[44px] w-full rounded-xl border border-white/15 bg-zinc-950 px-3 text-sm text-white">
        <option value="7">6+1 · 7 Spieler</option>
        <option value="9">U13 · 8+1 · 9 Spieler</option>
        <option value="11">Ab U14 · 10+1 · 11 Spieler</option>
      </select>
    </label>
    {format !== '7' && <>
      <label className="block text-xs font-semibold text-white/70">Formation
        <select value={system} onChange={event => setSystems(previous => ({ ...previous, [format]: event.target.value }))}
          className="mt-1 min-h-[44px] w-full rounded-xl border border-white/15 bg-zinc-950 px-3 text-sm text-white">
          {DEMO_FORMATION_SYSTEMS[format].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <p className="text-xs text-white/55">Formationsvorschau · {starters.length} Spieler am Feld</p>
      <div className="relative mx-auto aspect-[0.72] w-full max-w-xl overflow-hidden rounded-3xl border border-white/25 bg-[#226b2c]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0%, transparent 9%, rgba(255,255,255,.055) 9%, rgba(255,255,255,.055) 18%)' }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
          <g fill="none" stroke="white" strokeOpacity=".55" strokeWidth=".55">
            <rect x="6" y="8" width="88" height="124" /><path d="M6 70H94" />
            <circle cx="50" cy="70" r="11" /><rect x="24" y="8" width="52" height="20" />
            <rect x="24" y="112" width="52" height="20" />
            <rect x="37" y="8" width="26" height="8" /><rect x="37" y="124" width="26" height="8" />
          </g>
        </svg>
        {positions.map(({ x, y, label, player }, index) => player && <div key={player.id}
          className="absolute flex w-[21%] -translate-x-1/2 -translate-y-1/2 justify-center"
          style={{ left: `${x}%`, top: `${y}%` }}>
          <PitchPlayerMarker lastName={player.last_name?.trim() || playerName(player)}
            number={player.jersey_number} positionBadge={label} variant={index === 0 ? 'goalkeeper' : 'field'} mode="pitch" fullscreenLineup />
        </div>)}
      </div>
      <p className="text-xs font-bold tracking-widest text-white/60">ERSATZBANK</p>
      <div className="flex flex-wrap gap-4">
        {bench.map(player => <PitchPlayerMarker key={player.id} lastName={playerName(player)}
          number={player.jersey_number} positionBadge="" variant="field" mode="bank" />)}
      </div>
    </>}
  </section>;
}
