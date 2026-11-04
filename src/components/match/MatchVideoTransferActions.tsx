import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { shareWhatsAppStatusFile } from '../../lib/whatsAppStatusShare';

export function MatchVideoTransferActions({ objectPath, title, className = '' }: { objectPath: string; title: string; className?: string }) {
  const cached = useRef<File | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => { cached.current = null; setHint(null); }, [objectPath, title]);
  const prepare = async () => {
    if (cached.current) return cached.current;
    const { data, error } = await supabase.storage.from('match-videos').download(objectPath);
    if (error || !data) throw new Error('Video konnte nicht geladen werden. Bitte erneut versuchen.');
    const ext = /\.(mp4|mov|webm)$/i.exec(objectPath)?.[1]?.toLowerCase() || 'mp4';
    const name = title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 90) || 'Spielvideo';
    const mime = data.type.startsWith('video/') ? data.type : ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
    cached.current = new File([data], `${name}.${ext}`, { type: mime });
    return cached.current;
  };
  const transfer = async (action: 'download' | 'share') => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setHint(null);
    try {
      if (action === 'share' && !cached.current) {
        await prepare();
        setHint('Video bereit – erneut auf Teilen tippen und die gewünschte App auswählen.');
        return;
      }
      const file = await prepare();
      if (action === 'share') {
        const result = await shareWhatsAppStatusFile(file);
        if (result === 'downloaded') setHint('Video heruntergeladen. Du kannst es anschließend in deiner gewünschten App teilen.');
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url; link.download = file.name; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setHint('Download gestartet.');
      }
    } catch (error) {
      setHint(error instanceof Error ? error.message : 'Video konnte nicht übertragen werden.');
    } finally { pending.current = false; setBusy(false); }
  };
  return <div className={`border-t border-white/10 px-3 py-2 ${className}`}>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void transfer('download')} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-semibold disabled:opacity-50"><Download size={16} aria-hidden /> Herunterladen</button>
      <button type="button" disabled={busy} onClick={() => void transfer('share')} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-semibold disabled:opacity-50"><Share2 size={16} aria-hidden /> Teilen</button>
    </div>
    {busy ? <p className="mt-2 text-xs text-white/60" role="status">Video wird geladen …</p> : hint ? <p className="mt-2 text-xs text-white/60" role="status">{hint}</p> : null}
  </div>;
}
