import React from 'react';
import type { FieldSlotId } from '../../types/match';
import type { U11FormationId } from '../../lib/matchFormations';
import { U11_FORMATIONS } from '../../lib/matchFormations';

const PITCH_SURFACE: React.CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 24px, transparent 24px, transparent 48px)',
    'linear-gradient(to bottom, #2f8f38, #1e6b26, #174f1c)',
  ].join(', '),
};

const VB_MARGIN = 5;
const VB_W = 360;
const VB_H = 520;
const VB_MIN = -VB_MARGIN;
const VB_OUT_W = VB_W + 2 * VB_MARGIN;
const VB_OUT_H = VB_H + 2 * VB_MARGIN;

const LINE_INSET = 10;
const CX = VB_W / 2;
const CY = VB_H / 2;
const INNER_L = LINE_INSET;
const INNER_R = VB_W - LINE_INSET;
const INNER_T = LINE_INSET;
const INNER_B = VB_H - LINE_INSET;

const PEN_W = 170;
const PEN_H = 140;
const PEN_X = (VB_W - PEN_W) / 2;
const TOP_PEN_BOTTOM = INNER_T + PEN_H;
const BOTTOM_PEN_Y = VB_H - LINE_INSET - PEN_H;

const GA_W = 82;
const GA_H = 46;
const GA_X = (VB_W - GA_W) / 2;

const TOP_SIX_Y = 90;
const BOTTOM_SIX_Y = BOTTOM_PEN_Y + 50;

const TOP_SPOT_Y = TOP_PEN_BOTTOM - 22;
const BOTTOM_SPOT_Y = BOTTOM_PEN_Y + 22;

const LINE_STROKE = '#ffffff';
const LINE_OPACITY = 0.6;
const STROKE_W = 2;
/** Eckbögen (Eckball) – Kreisausschnitt innen am Spielfeldrand */
const CORNER_ARC = 12;
const TOUCHLINE_RX = 5;

const GOAL_W = 52;
const GOAL_H = 6;
const GOAL_X = (VB_W - GOAL_W) / 2;

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

  const gLine = {
    fill: 'none' as const,
    stroke: LINE_STROKE,
    strokeWidth: STROKE_W,
    strokeOpacity: LINE_OPACITY,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.55)] aspect-[3/4] max-h-[min(70dvh,560px)] ${className}`}
      style={PITCH_SURFACE}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_70px_rgba(0,0,0,0.18),inset_0_-16px_32px_rgba(0,0,0,0.12)]"
        aria-hidden
      />

      <svg
        className="pointer-events-none absolute inset-0 z-[0] h-full w-full"
        viewBox={`${VB_MIN} ${VB_MIN} ${VB_OUT_W} ${VB_OUT_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g {...gLine}>
          <rect
            x={INNER_L}
            y={INNER_T}
            width={VB_W - 2 * LINE_INSET}
            height={VB_H - 2 * LINE_INSET}
            rx={TOUCHLINE_RX}
            ry={TOUCHLINE_RX}
          />

          <path d={`M ${INNER_L} ${INNER_T + CORNER_ARC} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_L + CORNER_ARC} ${INNER_T}`} />
          <path d={`M ${INNER_R - CORNER_ARC} ${INNER_T} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_R} ${INNER_T + CORNER_ARC}`} />
          <path d={`M ${INNER_R} ${INNER_B - CORNER_ARC} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_R - CORNER_ARC} ${INNER_B}`} />
          <path d={`M ${INNER_L + CORNER_ARC} ${INNER_B} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_L} ${INNER_B - CORNER_ARC}`} />

          <line x1={INNER_L} y1={CY} x2={INNER_R} y2={CY} />

          <circle cx={CX} cy={CY} r="50" />
          <circle cx={CX} cy={CY} r="3.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={PEN_X} y={INNER_T} width={PEN_W} height={PEN_H} />
          <rect x={PEN_X} y={BOTTOM_PEN_Y} width={PEN_W} height={PEN_H} />

          <rect x={GA_X} y={INNER_T} width={GA_W} height={GA_H} />
          <rect x={GA_X} y={INNER_B - GA_H} width={GA_W} height={GA_H} />

          <path d={`M ${PEN_X} ${TOP_PEN_BOTTOM} Q ${CX} ${TOP_PEN_BOTTOM + 36} ${PEN_X + PEN_W} ${TOP_PEN_BOTTOM}`} />
          <path d={`M ${PEN_X} ${BOTTOM_PEN_Y} Q ${CX} ${BOTTOM_PEN_Y - 36} ${PEN_X + PEN_W} ${BOTTOM_PEN_Y}`} />

          <line x1={PEN_X} y1={TOP_SIX_Y} x2={PEN_X + PEN_W} y2={TOP_SIX_Y} />
          <line x1={PEN_X} y1={BOTTOM_SIX_Y} x2={PEN_X + PEN_W} y2={BOTTOM_SIX_Y} />

          <circle cx={CX} cy={TOP_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />
          <circle cx={CX} cy={BOTTOM_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={GOAL_X} y={INNER_T - GOAL_H} width={GOAL_W} height={GOAL_H} rx="1" />
          <rect x={GOAL_X} y={INNER_B} width={GOAL_W} height={GOAL_H} rx="1" />
        </g>
      </svg>

      <div className="absolute inset-[3.5%] z-[1] min-h-0">
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
