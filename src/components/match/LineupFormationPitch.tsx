import React from 'react';
import type { FieldSlotId } from '../../types/match';
import type { U11FormationId } from '../../lib/matchFormations';
import { U11_FORMATIONS } from '../../lib/matchFormations';

export type LineupFormationPitchProps = {
  formationId: U11FormationId;
  slots: Record<FieldSlotId, string | null>;
  interactive?: boolean;
  onSlotTap?: (slot: FieldSlotId) => void;
  selectedBankPlayerId?: string | null;
  assignFlashSlot?: FieldSlotId | null;
  /** Inhalt pro Slot (Jersey oder Platzhalter) */
  renderSlotContent: (ctx: {
    slot: FieldSlotId;
    label: string;
    playerId: string | null;
    empty: boolean;
    dropHint: boolean;
    flash: boolean;
    isGk: boolean;
  }) => React.ReactNode;
  className?: string;
};

/**
 * Spielfeld ~2:3, Linien wie klassisches Kleinfeld; Spieler absolut über Prozent aus matchFormations.
 */
export function LineupFormationPitch({
  formationId,
  slots,
  interactive = false,
  onSlotTap,
  selectedBankPlayerId,
  assignFlashSlot,
  renderSlotContent,
  className = '',
}: LineupFormationPitchProps): React.ReactElement {
  const layout = U11_FORMATIONS[formationId];

  return (
    <div
      className={`relative w-full overflow-visible rounded-2xl border border-white/12 bg-[#070b0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] aspect-[2/3] max-h-[min(72vh,520px)] ${className}`}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-white"
        viewBox="0 0 360 520"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <rect x="0" y="0" width="360" height="520" fill="#0a1510" />
        <g fill="none" stroke="currentColor" strokeWidth="1.45" style={{ opacity: 0.38 }}>
          <rect x="1.5" y="1.5" width="357" height="517" rx="2" />
          <line x1="180" y1="0" x2="180" y2="520" />
          <circle cx="180" cy="260" r="52" />
          <circle cx="180" cy="260" r="3.5" fill="currentColor" />
          <rect x="95" y="380" width="170" height="140" />
          <line x1="95" y1="430" x2="265" y2="430" />
          <rect x="95" y="0" width="170" height="140" />
          <line x1="95" y1="90" x2="265" y2="90" />
        </g>
      </svg>

      <div className="absolute inset-0 z-[1]">
        {layout.map(({ slot, label, x, y }) => {
          const playerId = slots[slot] ?? null;
          const empty = !playerId;
          const dropHint = empty && Boolean(selectedBankPlayerId) && interactive;
          const flash = assignFlashSlot === slot;
          const isGk = slot === 'GK';

          const inner = renderSlotContent({
            slot,
            label,
            playerId,
            empty,
            dropHint,
            flash,
            isGk,
          });

          if (!interactive || !onSlotTap) {
            return (
              <div
                key={slot}
                className="pointer-events-none absolute flex flex-col items-center justify-center"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
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
              className={[
                'absolute flex min-h-[5.75rem] min-w-[5rem] flex-col items-center justify-center rounded-xl px-0.5 py-0.5 transition-all duration-300 ease-out active:scale-[0.97]',
                empty
                  ? dropHint
                    ? 'border-2 border-dashed border-emerald-400/55 bg-black/25 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
                    : 'border border-dashed border-white/22 bg-black/20 hover:bg-black/30'
                  : 'border border-white/12 bg-black/25 shadow-none',
                flash ? 'ring-2 ring-emerald-400/55 ring-offset-2 ring-offset-[#070b0a]' : '',
              ].join(' ')}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
