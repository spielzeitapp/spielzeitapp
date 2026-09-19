import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Pencil, RotateCcw, X } from 'lucide-react';
import { updateAutoFeedPostMedia, type AutoFeedPostMediaRow } from '../../lib/updateAutoFeedPostMedia';

type Props = {
  post: AutoFeedPostMediaRow;
  onUpdated: () => void;
  title?: string;
};

export const AutoFeedPostMediaEditButton: React.FC<Props> = ({ post, onUpdated, title = 'Autopost-Bild' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCustomImage = Boolean(post.media_url?.trim());

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setError(null);
  };

  const runUpdate = async (remove: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await updateAutoFeedPostMedia({ post, file, remove });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFile(null);
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFile(null);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 p-2 text-white/85 backdrop-blur-sm transition hover:border-red-400/40 hover:bg-black/70"
        aria-label={`${title} bearbeiten`}
        title={`${title} bearbeiten`}
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>

      {open ? createPortal(
        <div
          className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/80 pt-[max(1rem,env(safe-area-inset-top,0px))] backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`auto-feed-image-dialog-${post.id}`}
        >
          <div className="flex max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top,0px)))] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-red-500/30 bg-[#100d11] shadow-2xl sm:max-h-[92dvh] sm:rounded-[28px]">
            <div className="min-h-0 overflow-y-auto overscroll-contain p-5 pb-4 [-webkit-overflow-scrolling:touch]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-400">Autopost bearbeiten</p>
                  <h2 id={`auto-feed-image-dialog-${post.id}`} className="mt-1 text-2xl font-black text-white">{title} ändern</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    Das eigene Bild ersetzt die automatische Grafik. Alle Daten und der Beitrag bleiben gespeichert.
                  </p>
                </div>
                <button type="button" onClick={close} className="shrink-0 rounded-full border border-white/10 p-2 text-white/70" aria-label="Schließen">
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 flex min-h-[82px] w-full items-center gap-4 rounded-2xl border border-dashed border-red-400/40 bg-red-950/20 px-4 text-left text-white"
              >
                <span className="rounded-xl bg-red-600/20 p-3 text-red-300"><ImagePlus className="h-6 w-6" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block font-bold">{hasCustomImage ? 'Bild austauschen' : 'Eigenes Bild hochladen'}</span>
                  <span className="block truncate text-sm text-white/55">{file ? file.name : 'JPG, PNG oder WebP auswählen'}</span>
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />

              {hasCustomImage ? (
                <button
                  type="button"
                  onClick={() => void runUpdate(true)}
                  disabled={busy}
                  className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-4 font-bold text-white/85 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Automatische Grafik wiederherstellen
                </button>
              ) : null}

              {error ? <p className="mt-3 text-sm font-semibold text-red-300">{error}</p> : null}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/10 bg-[#100d11] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3">
              <button type="button" onClick={close} disabled={busy} className="min-h-[54px] rounded-2xl border border-white/15 font-bold text-white">Abbrechen</button>
              <button
                type="button"
                onClick={() => void runUpdate(false)}
                disabled={busy || !file}
                className="min-h-[54px] rounded-2xl bg-gradient-to-r from-red-800 to-red-600 font-black text-white disabled:opacity-50"
              >
                {busy ? 'Speichern…' : 'Bild speichern'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
};
