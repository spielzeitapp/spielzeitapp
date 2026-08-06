import React from 'react';
import { dsCardShellClass, dsCardAmbientGlowClass } from '../../lib/premiumDesignSystem';

type Props = {
  onStart: () => void;
  onLater: () => void;
};

export function DemoWelcomeModal({ onStart, onLater }: Props): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-welcome-title"
    >
      <div className={dsCardShellClass({ className: 'relative max-w-md' })}>
        <div className={dsCardAmbientGlowClass()} aria-hidden />
        <div className="relative z-10 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FF2D2D]/90">
            Trainer-Demo
          </p>
          <h2 id="demo-welcome-title" className="text-lg font-semibold text-white">
            Willkommen in der SpielzeitApp-Demo
          </h2>
          <p className="text-sm leading-relaxed text-white/75">
            Dieses U12-Demoteam ist bereits vollständig vorbereitet. Du kannst alle Bereiche ansehen
            und ausgewählte Funktionen ausprobieren. Änderungen werden nicht dauerhaft gespeichert.
          </p>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="min-h-[44px] flex-1 rounded-xl bg-[#FF2D2D] px-4 text-sm font-semibold text-white"
            >
              Demo starten
            </button>
            <button
              type="button"
              onClick={onLater}
              className="min-h-[44px] flex-1 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white/90"
            >
              Später ansehen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
