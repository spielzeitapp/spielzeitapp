import React from 'react';
import type { FieldSlotId } from '../../types/match';
import type { U11FormationId } from '../../lib/matchFormations';
import { U11_FORMATIONS } from '../../lib/matchFormations';

/** Dunkleres Grün + waagerechte Rasen-Streifen */
const PITCH_SURFACE: React.CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 22px, transparent 22px, transparent 44px)',
    'linear-gradient(to bottom, #24692a, #1a4a20)',
  ].join(', '),
};

/** Linien mit 10px-Inset zum ViewBox-Rand (360×520); Mittelpunkt (180,260) */
const LINE_INSET = 10;
const VB_W = 360;
const VB_H = 520;
const CX = VB_W / 2;
const CY = VB_H / 2;
const INNER_L = LINE_INSET;
const INNER_R = VB_W - LINE_INSET;
const INNER_T = LINE_INSET;
const INNER_B = VB_H - LINE_INSET;
const PEN_W = 170;
const PEN_H = 140;
const PEN_X = (VB_W - PEN_W) / 2;
const BOTTOM_PEN_Y = VB_H - LINE_INSET - PEN_H;
const BOTTOM_SIX_Y = BOTTOM_PEN_Y + 50;
const TOP_SIX_Y = 90;

export type LineupFormationPitchProps = {
  formationId: U11FormationId;
  slots: Record<FieldSlotId, string | null>;
  interactive?: boolean;
  onSlotTap?: (slot: FieldSlotId) => void;
  selectedBankPlayerId?: string | null;
  assignFlashSlot?: FieldSlotId | null;
  emphasizedPlayerId?: string | null;
  renderSlotContent: (ctx: {
    slot: FieldSlotId;
    label: string;
    playerId: string | null;
    empty: boolean;
    dropHint: boolean;
    flash: boolean;
    isGk: boolean;
    emphasize: boolean;
  }) => React.ReactNode;
  className?: string;
};

export function LineupFormationPitch({
  formationId,
  slots,
  interactive = false,
  onSlotTap,
  selectedBankPlayerId,
  assignFlashSlot,
  emphasizedPlayerId = null,
  renderSlotContent,
  className = '',
}: LineupFormationPitchProps): React.ReactElement {
  const layout = U11_FORMATIONS[formationId];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-black/35 aspect-[3/4] max-h-[min(70dvh,560px)] shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_10px_36px_rgba(0,0,0,0.45),0_0_60px_rgba(34,197,94,0.14)] ${className}`}
      style={PITCH_SURFACE}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g fill="none" stroke="#ffffff" strokeWidth="1.35" style={{ opacity: 0.18 }}>
          <rect x={INNER_L} y={INNER_T} width={VB_W - 2 * LINE_INSET} height={VB_H - 2 * LINE_INSET} rx="2" />
          <line x1={CX} y1={INNER_T} x2={CX} y2={INNER_B} />
          <line x1={INNER_L} y1={CY} x2={INNER_R} y2={CY} />
          <circle cx={CX} cy={CY} r="50" />
          <circle cx={CX} cy={CY} r="3.5" fill="#ffffff" style={{ opacity: 0.35 }} />
          <rect x={PEN_X} y={LINE_INSET} width={PEN_W} height={PEN_H} />
          <line x1={PEN_X} y1={TOP_SIX_Y} x2={PEN_X + PEN_W} y2={TOP_SIX_Y} />
          <rect x={PEN_X} y={BOTTOM_PEN_Y} width={PEN_W} height={PEN_H} />
          <line x1={PEN_X} y1={BOTTOM_SIX_Y} x2={PEN_X + PEN_W} y2={BOTTOM_SIX_Y} />
        </g>
      </svg>

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_100px_rgba(0,0,0,0.32),inset_0_-20px_40px_rgba(0,0,0,0.18)]"
        aria-hidden
      />

      {/* Innenabstand: Spieler-Marker nicht am Rand abschneiden */}
      <div className="absolute inset-[3%] z-[1] min-h-0">
        {layout.map(({ slot, label, x, y }) => {
          const playerId = slots[slot] ?? null;
          const empty = !playerId;
          const dropHint = empty && Boolean(selectedBankPlayerId) && interactive;
          const flash = assignFlashSlot === slot;
          const isGk = slot === 'GK';
          const emphasize = Boolean(playerId && emphasizedPlayerId && playerId === emphasizedPlayerId);

          const inner = renderSlotContent({
            slot,
            label,
            playerId,
            empty,
            dropHint,
            flash,
            isGk,
            emphasize,
          });

          const slotStyle = { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' } as const;

          if (!interactive || !onSlotTap) {
            return (
              <div
                key={slot}
                className="pointer-events-none absolute flex flex-col items-center justify-center"
                style={slotStyle}
              >
                {inner}
              </div>
            );
          }

          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSlotTap(slot)}
              title={label}
              className={[
                'absolute flex flex-col items-center justify-center rounded-full border border-transparent bg-transparent px-0.5 py-0 transition-all duration-300 ease-out active:scale-[0.98]',
                empty ? 'min-h-[48px] min-w-[48px]' : 'min-h-0 min-w-0',
                dropHint ? 'ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent' : '',
                flash ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-emerald-900/40' : '',
              ].join(' ')}
              style={slotStyle}
            >
              <span className="sr-only">
                {label}
                {empty ? ', frei antippen zum Zuweisen' : ''}
              </span>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
