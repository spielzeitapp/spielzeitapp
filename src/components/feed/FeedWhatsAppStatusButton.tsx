import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { prepareWhatsAppStatusFile, shareWhatsAppStatusFile } from '../../lib/whatsAppStatusShare';

export function FeedWhatsAppStatusButton({ onShareFallback }: { onShareFallback?: () => void } = {}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const file = useRef<File | null>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const prepare = useCallback(async () => {
    const root = wrapper.current?.closest<HTMLElement>('article, [data-whatsapp-status-root]');
    if (!root) return;
    const version = ++generation.current;
    file.current = null;
    setBusy(true);
    try {
      const next = await prepareWhatsAppStatusFile(root);
      if (version === generation.current) file.current = next;
    } catch {
      if (version === generation.current) file.current = null;
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const root = wrapper.current?.closest<HTMLElement>('article, [data-whatsapp-status-root]');
    if (!root) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      ++generation.current;
      file.current = null;
      clearTimeout(timer);
      setBusy(false);
      if (visible && !root.querySelector('[data-whatsapp-status-video]')) timer = setTimeout(() => void prepare(), 350);
    };
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => !wrapper.current?.contains(change.target))) schedule();
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['src'] });
    const intersection = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !file.current) schedule();
        }) : null;
    if (intersection) intersection.observe(wrapper.current!);
    else { visible = true; schedule(); }
    return () => { ++generation.current; clearTimeout(timer); observer.disconnect(); intersection?.disconnect(); };
  }, [prepare]);

  const onClick = async () => {
    const root = wrapper.current?.closest<HTMLElement>('article, [data-whatsapp-status-root]');
    if (!root?.querySelector('[data-whatsapp-status-image], [data-whatsapp-status-poster], [data-whatsapp-status-video]')) {
      onShareFallback?.();
      return;
    }
    if (!file.current) {
      await prepare();
      setHint(file.current ? 'Datei bereit – tippe erneut und wähle die gewünschte App.' : 'Datei noch nicht verfügbar. Bitte erneut versuchen.');
      return;
    }
    try {
      const outcome = await shareWhatsAppStatusFile(file.current);
      if (outcome === 'downloaded') setHint('Datei heruntergeladen – anschließend in der gewünschten App auswählen.');
    } catch {
      setHint('Teilen nicht möglich. Bitte erneut versuchen.');
    }
  };

  return <div ref={wrapper} className="border-t border-white/[0.06] px-3 pb-3 pt-2 sm:px-4">
    <button type="button" disabled={busy} onClick={() => void onClick()}
      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/30 px-3 text-[13px] font-semibold text-emerald-200 disabled:opacity-50"
      aria-label="Story / Status teilen">
      <Share2 className="h-4 w-4" aria-hidden />
      {busy ? 'Datei wird vorbereitet…' : 'Story / Status teilen'}
    </button>
    {hint ? <p className="mt-1.5 text-center text-[10px] leading-snug text-white/50" role="status">{hint}</p> : null}
  </div>;
}
