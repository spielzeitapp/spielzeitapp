import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, LockKeyhole, Play, Send, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadStorageObject } from '../../lib/storageUpload';

type MatchVideo = {
  id: string;
  match_id: string;
  team_season_id: string;
  object_path: string;
  title: string;
  category: string;
  visibility: 'staff' | 'team';
  created_at: string;
};

const CATEGORIES: Record<string, string> = {
  highlights: 'Highlights', goals: 'Tore', chances: 'Chancen',
  defence: 'Abwehr', player: 'Spielerszene',
};
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};

type Props = {
  matchId: string;
  teamSeasonId: string;
  canManage: boolean;
  demoMode?: boolean;
};

export const MatchVideosPanel: React.FC<Props> = ({ matchId, teamSeasonId, canManage, demoMode = false }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('highlights');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('match_videos')
      .select('id,match_id,team_season_id,object_path,title,category,visibility,created_at')
      .eq('match_id', matchId).order('created_at', { ascending: false });
    if (loadError) setError('Spielvideos konnten nicht geladen werden. Ist die Datenbank-Erweiterung bereits eingerichtet?');
    else { setVideos((data ?? []) as MatchVideo[]); setError(null); }
    setLoading(false);
  }, [matchId]);

  useEffect(() => { setLoading(true); void reload(); }, [reload]);

  const upload = async (file: File | undefined) => {
    if (!file || !canManage || demoMode || busy) return;
    const ext = VIDEO_EXT[file.type];
    if (!ext || file.size > MAX_VIDEO_BYTES) {
      setError('Bitte ein MP4-, MOV- oder WebM-Video bis 150 MB wählen. Für längere Spiele zuerst Highlights exportieren.');
      return;
    }
    if (!title.trim()) { setError('Bitte zuerst einen Titel eingeben.'); return; }
    setBusy(true); setError(null);
    const id = crypto.randomUUID();
    const objectPath = `${teamSeasonId}/${matchId}/${id}.${ext}`;
    try {
      const { error: insertError } = await supabase.from('match_videos').insert({
        id, match_id: matchId, team_season_id: teamSeasonId,
        object_path: objectPath, title: title.trim(), category, visibility: 'staff',
      });
      if (insertError) throw insertError;
      const { error: uploadError } = await uploadStorageObject('match-videos', objectPath, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) {
        await supabase.from('match_videos').delete().eq('id', id);
        throw new Error(uploadError.message);
      }
      setTitle(''); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const play = async (video: MatchVideo) => {
    setPlayingId(null); setPlayingUrl(null); setError(null);
    const { data, error: signError } = await supabase.storage.from('match-videos')
      .createSignedUrl(video.object_path, 300);
    if (signError || !data?.signedUrl) {
      setError('Video derzeit nicht verfügbar oder keine Freigabe.');
      return;
    }
    setPlayingId(video.id); setPlayingUrl(data.signedUrl);
  };

  const publish = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!window.confirm(`„${video.title}“ für Eltern und Spieler dieses Teams im Feed freigeben? Fans erhalten keinen Zugriff.`)) return;
    setBusy(true); setError(null);
    const { error: publishError } = await supabase.rpc('publish_match_video', {
      p_video_id: video.id, p_caption: video.title,
    });
    if (publishError) setError(publishError.message);
    else await reload();
    setBusy(false);
  };

  const unpublish = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!window.confirm('Freigabe zurücknehmen und Feed-Beitrag entfernen? Bereits heruntergeladene Kopien bleiben davon unberührt.')) return;
    setBusy(true); setError(null); setPlayingUrl(null); setPlayingId(null);
    const { error: unpublishError } = await supabase.rpc('unpublish_match_video', { p_video_id: video.id });
    if (unpublishError) setError(unpublishError.message);
    else await reload();
    setBusy(false);
  };

  return <section aria-label="Videos zum Spiel" className="mx-auto max-w-2xl space-y-4 pb-8 text-white">
    <div className="rounded-2xl border border-red-500/25 bg-gradient-to-b from-red-950/35 to-zinc-950 p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Clapperboard className="text-red-400" aria-hidden /> Videos zum Spiel</h2>
      <p className="mt-1 text-sm text-white/65">Highlights und Spielszenen zu diesem Match.</p>
    </div>

    {canManage && !demoMode && <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={17} aria-hidden /> Neues Video – zunächst nur für Trainer</div>
      <label className="block text-sm">Titel<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="z. B. Alle Highlights" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white" /></label>
      <label className="block text-sm">Kategorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white">{Object.entries(CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      <button type="button" disabled={busy || !title.trim()} onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-50"><UploadCloud size={18} aria-hidden />{busy ? 'Bitte warten …' : 'Highlight hochladen'}</button>
      <p className="text-xs text-white/55">MP4, MOV oder WebM · maximal 150 MB · kein komplettes Rohspiel.</p>
    </div>}

    {error && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
    {loading ? <p className="text-sm text-white/60">Videos werden geladen …</p> : videos.length === 0 ? <p className="rounded-xl border border-white/10 p-5 text-sm text-white/70">Noch keine für dich freigegebenen Videos zu diesem Spiel.</p> :
      <div className="space-y-3">{videos.map(video => <article key={video.id} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-medium text-red-300">{CATEGORIES[video.category] ?? 'Video'}</div><h3 className="mt-1 font-semibold">{video.title}</h3></div><span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs">{video.visibility === 'team' ? 'Im Team-Feed' : 'Nur Trainer'}</span></div>
        {playingId === video.id && playingUrl && <video key={playingUrl} src={playingUrl} controls playsInline preload="metadata" className="mt-3 w-full rounded-xl" />}
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void play(video)} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm"><Play size={16} aria-hidden /> Abspielen</button>
          {canManage && (video.visibility === 'staff' ? <button type="button" disabled={busy} onClick={() => void publish(video)} className="flex min-h-11 items-center gap-2 rounded-xl border border-red-500/50 px-3 text-sm text-red-200 disabled:opacity-50"><Send size={16} aria-hidden /> Im Feed teilen</button> : <button type="button" disabled={busy} onClick={() => void unpublish(video)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm disabled:opacity-50">Freigabe zurücknehmen</button>)}
        </div>
      </article>)}</div>}
  </section>;
};
