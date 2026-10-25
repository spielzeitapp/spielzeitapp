import React, { useEffect, useRef, useState } from 'react';
import { PitchPlayerMarker } from '../../components/match/PitchPlayerMarker';
import type { PlayerItem } from '../../hooks/usePlayers';

export const DEMO_FORMATION_SYSTEMS = {
  '9': ['3-3-2', '3-4-1', '3-2-3', '4-3-1'],
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
  '3-4-1': [...keeper, ...backThree, ...line(44, ['LM', 'ZM', 'ZM', 'RM'], [16, 39, 61, 84]), ...line(18, ['ST'], [50])],
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = pickerRef.current;
    if (pickerOpen && format !== '7') dialog?.showModal();
    else dialog?.close();
  }, [pickerOpen, format]);
  const system = format === '7' ? '' : systems[format];
  const starters = players.slice(0, Number(format));
  const bench = players.slice(Number(format));
  const positions = format === '7' ? [] : DEMO_FORMATION_LAYOUTS[system].map((position, index) => ({
    ...position, player: starters[index],
  }));
  return <section className="space-y-3 py-3" aria-label="Demo-Spielformat">
    <div>
      <p id="demo-format-label" className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Spielformat</p>
      <div role="group" aria-labelledby="demo-format-label" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-red-500/15 bg-gradient-to-br from-red-950/15 to-black p-1.5">
        {([
          { value: '7', title: '6+1', subtitle: '7 Spieler' },
          { value: '9', title: '8+1', subtitle: 'U13' },
          { value: '11', title: '10+1', subtitle: 'Ab U14' },
        ] as const).map(option => {
          const active = format === option.value;
          return <button key={option.value} type="button" aria-pressed={active}
            onClick={() => { setPickerOpen(false); onFormatChange(option.value); }}
            className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 transition-colors ${active
              ? 'border-red-400/40 bg-gradient-to-b from-red-800/65 to-red-950/75 text-white shadow-[0_0_14px_rgba(220,38,38,0.12)]'
              : 'border-transparent bg-black/20 text-white/50 hover:border-white/10 hover:text-white/80'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400`}>
            <span className="text-base font-black leading-tight">{option.title}</span>
            <span className={`text-[10px] font-semibold ${active ? 'text-red-100/80' : 'text-white/40'}`}>{option.subtitle}</span>
          </button>;
        })}
      </div>
    </div>
    {format !== '7' && <>
      <button type="button" onClick={() => setPickerOpen(true)} aria-haspopup="dialog"
        className="flex min-h-[46px] w-full items-center justify-between rounded-xl border border-red-500/25 bg-red-950/25 px-4 text-sm font-bold text-white">
        <span>Formation · {system}</span><span aria-hidden>⌃</span>
      </button>
      <dialog ref={pickerRef} onClose={() => setPickerOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setPickerOpen(false); }}
        aria-labelledby="demo-formation-picker-title"
        className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/15 bg-zinc-950 p-4 text-white shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-md">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/25" />
        <h3 id="demo-formation-picker-title" className="text-center text-lg font-black">Formation ändern</h3>
        <p className="mb-3 mt-1 text-center text-xs text-white/50">{format === '9' ? 'U13 · 8+1' : 'Ab U14 · 10+1'} · Formationsvorschau</p>
        <div className="space-y-2">
          {DEMO_FORMATION_SYSTEMS[format].map(value => {
            const active = value === system;
            const descriptions: Record<string, string> = {
              '3-4-1': 'Vier Mittelfeldspieler · eine Spitze',
              '3-3-2': 'Drei Mittelfeldspieler · zwei Spitzen', '3-2-3': 'Zwei zentrale Mittelfeldspieler · drei Angreifer',
              '4-3-1': 'Viererkette · drei Mittelfeldspieler', '4-4-2': 'Vierer-Mittelfeld · zwei Spitzen',
              '4-3-3': 'Ein Sechser · zwei Achter · drei Angreifer', '4-2-3-1': 'Doppelsechs · ein Zehner',
              '3-5-2': 'Dreierkette · zwei Flügelverteidiger',
            };
            return <button key={value} type="button" aria-pressed={active}
              onClick={() => { setSystems(previous => ({ ...previous, [format]: value })); setPickerOpen(false); }}
              className={`grid min-h-[76px] w-full grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left ${active ? 'border-emerald-400/40 bg-emerald-950/30' : 'border-white/10 bg-black/60'}`}>
              <svg viewBox="0 0 100 140" className="h-[70px] w-[50px] rounded-lg border border-white/40 bg-emerald-950/40" aria-hidden>
                <g fill="none" stroke="white" strokeOpacity=".65" strokeWidth="2">
                  <rect x="7" y="7" width="86" height="126" rx="8" /><path d="M7 70H93" /><circle cx="50" cy="70" r="14" />
                  <path d="M27 7V26H73V7 M27 133V114H73V133" />
                </g>
                {DEMO_FORMATION_LAYOUTS[value].map((position, index) => <circle key={index} cx={position.x} cy={position.y * 1.4} r="5"
                  fill={index === 0 ? '#facc15' : active ? '#34d399' : '#fff'} />)}
              </svg>
              <span><span className="block text-xl font-black">{value}</span><span className="mt-1 block text-xs text-white/55">{descriptions[value]}</span></span>
              <span className={active ? 'text-[10px] font-bold text-emerald-300' : 'text-xl text-white/40'}>{active ? 'AKTIV' : '›'}</span>
            </button>;
          })}
        </div>
        <button type="button" onClick={() => setPickerOpen(false)} className="mt-3 min-h-[48px] w-full rounded-xl border border-white/40 bg-white/5 font-bold">Schließen</button>
      </dialog>
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
