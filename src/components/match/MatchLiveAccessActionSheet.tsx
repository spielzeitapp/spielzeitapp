import React, { useEffect } from 'react';
import { ChevronRight, ClipboardList, Radio } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onPrepare: () => void;
  onLive: () => void;
  liveActionLabel?: string;
};

export function MatchLiveAccessActionSheet({
  open,
  onClose,
  onPrepare,
  onLive,
  liveActionLabel = 'Live starten',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/78 backdrop-blur-[3px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(28,8,8,0.98)_0%,rgba(0,0,0,0.97)_42%,rgba(6,6,10,0.99)_100%)] shadow-[0_-24px_64px_rgba(0,0,0,0.72),0_0_48px_rgba(220,38,38,0.08)] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-live-access-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(220,38,38,0.12)_0%,transparent_58%)]"
          aria-hidden
        />
        <div className="relative px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 sm:pb-5 sm:pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
          <h2
            id="match-live-access-sheet-title"
            className="text-center text-[15px] font-bold tracking-tight text-white sm:text-left"
          >
            Spielaktion wählen
          </h2>
          <p className="mt-1 text-center text-[12px] leading-snug text-white/55 sm:text-left">
            Vorbereitung bearbeiten oder Livemodus öffnen
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3.5 py-3 text-left transition hover:border-white/18 hover:bg-white/[0.05] active:scale-[0.99]"
              onClick={onPrepare}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-950/45 text-red-300">
                <ClipboardList className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-white">Match vorbereiten</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/58">
                  Aufstellung, Kader und Feed-Automation bearbeiten
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-3.5 py-3 text-left shadow-[0_0_24px_rgba(16,185,129,0.08)] transition hover:border-emerald-400/35 hover:bg-emerald-950/40 active:scale-[0.99]"
              onClick={onLive}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-900/40 text-emerald-300">
                <Radio className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-emerald-100">{liveActionLabel}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-emerald-100/65">
                  Spiel starten oder Livemodus öffnen
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-200/45" aria-hidden />
            </button>
          </div>

          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white/72 transition hover:bg-white/[0.07]"
            onClick={onClose}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
