import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { DEMO_TOUR_WINNER_DISCLAIMER } from '../demoTourConfig';
import { buildDemoWinnerPreviewData } from '../demoTourActions';

type Props = {
  open: boolean;
  onClose: () => void;
  onFinishTour: () => void;
  onExploreFree: () => void;
};

/**
 * Rein lokale Siegerpost-Vorschau — kein Feed-Write, kein Share, keine API.
 */
export function DemoWinnerPostPreview({
  open,
  onClose,
  onFinishTour,
  onExploreFree,
}: Props): React.ReactElement | null {
  const preview = useMemo(() => buildDemoWinnerPreviewData(), [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-10 sm:items-center sm:pb-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-winner-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
              {DEMO_TOUR_WINNER_DISCLAIMER}
            </p>
            <h2 id="demo-winner-title" className="mt-1 text-[16px] font-semibold text-white">
              Ergebnis-Vorschau
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/55 hover:bg-white/5 hover:text-white"
            aria-label="Vorschau schließen"
          >
            <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-xl border border-white/10 bg-gradient-to-b from-red-950/50 to-black/40 px-4 py-4 text-center">
            <p className="text-[12px] font-medium text-white/55">{preview.homeName}</p>
            <p className="mt-1 text-[28px] font-black tabular-nums tracking-tight text-white">
              {preview.homeScore}:{preview.awayScore}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-white/80">vs. {preview.awayName}</p>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-snug text-emerald-300/90">
              {preview.caption}
            </p>
          </div>

          {preview.scorers.length > 0 ? (
            <ul className="space-y-1.5">
              {preview.scorers.map((s) => (
                <li
                  key={`${s.player_name}-${s.minute_label}`}
                  className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-white/70"
                >
                  {s.minute_label} Tor {s.player_name}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-[11px] leading-snug text-white/40">
            Nur lokale Demo-Vorschau. Kein Feed, kein WhatsApp, keine Push-Nachricht und kein
            Social-Media-Post.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onFinishTour}
            className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
          >
            Rundgang abschließen
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
          >
            Vorschau schließen
          </button>
          <button
            type="button"
            onClick={onExploreFree}
            className="w-full py-1 text-center text-[11px] font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Demo weiter frei erkunden
          </button>
        </div>
      </div>
    </div>
  );
}
