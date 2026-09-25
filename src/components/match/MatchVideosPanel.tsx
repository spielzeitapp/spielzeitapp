import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Clapperboard, LockKeyhole, MapPin, Pencil, Play, Send, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadStorageObject } from '../../lib/storageUpload';

type MatchVideo = {
  id: string;
  match_id: string;
  team_season_id: string;
  object_path: string;
  title: string;
  category: string;
  scene_type: string | null;
  scene_minute: number | null;
  analysis_note: string | null;
  visibility: 'staff' | 'team';
  created_at: string;
};

const CATEGORIES: Record<string, string> = {
  highlights: 'Highlights', goals: 'Tore', chances: 'Chancen',
  defence: 'Abwehr', player: 'Spielerszene', analysis: 'Spielanalyse',
};
const SCENE_TYPES: Record<string, string> = {
  goal: 'Tore', shot: 'Schüsse', save: 'Paraden', corner: 'Ecken', defence: 'Abwehr', other: 'Weitere Szenen',
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
  mode?: 'videos' | 'analysis';
  showResultHeader?: boolean;
  matchInfo?: {
    homeTeam: string;
    awayTeam: string;
    homeLogoUrl?: string | null;
    awayLogoUrl?: string | null;
    date?: string;
    dateIso?: string | null;
    matchType?: string;
    periodScore?: string;
    location?: string | null;
    score?: string;
  };
};

const initialFeedText = (video: MatchVideo, matchInfo?: Props['matchInfo']) => {
  const lines = [video.title.trim()];
  if (matchInfo?.homeTeam && matchInfo.awayTeam) lines.push(`${matchInfo.homeTeam} – ${matchInfo.awayTeam}`);
  if (matchInfo?.date) lines.push(`Spiel vom ${matchInfo.date}`);
  if (matchInfo?.score) lines.push(`Endstand: ${matchInfo.score}`);
  if (matchInfo?.location?.trim()) lines.push(`Spielort: ${matchInfo.location.trim()}`);
  return lines.join('\n').slice(0, 500);
};

export const MatchVideosPanel: React.FC<Props> = ({ matchId, teamSeasonId, canManage, demoMode = false, matchInfo, mode = 'videos', showResultHeader = true }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('highlights');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('highlights');
  const [composerId, setComposerId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [sceneType, setSceneType] = useState('other');
  const [sceneMinute, setSceneMinute] = useState('');
  const [analysisNote, setAnalysisNote] = useState('');
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const visibleVideos = videos.filter(video => mode === 'analysis' ? video.category === 'analysis' : video.category !== 'analysis');
  const filteredVideos = mode === 'analysis' && analysisFilter !== 'all'
    ? visibleVideos.filter(video => (video.scene_type ?? 'other') === analysisFilter)
    : visibleVideos;

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('match_videos')
      .select('id,match_id,team_season_id,object_path,title,category,scene_type,scene_minute,analysis_note,visibility,created_at')
      .eq('match_id', matchId).order('created_at', { ascending: false });
    if (loadError) setError('Spielvideos konnten nicht geladen werden. Ist die Datenbank-Erweiterung bereits eingerichtet?');
    else {
      const loaded = (data ?? []) as MatchVideo[];
      setVideos(loaded); setError(null);
      if (mode === 'analysis') {
        const previews = await Promise.all(loaded.filter(v => v.category === 'analysis').map(async video => {
          const { data: signed } = await supabase.storage.from('match-videos').createSignedUrl(video.object_path, 600);
          return [video.id, signed?.signedUrl ?? ''] as const;
        }));
        setPreviewUrls(Object.fromEntries(previews));
      }
    }
    setLoading(false);
  }, [matchId, mode]);

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
        object_path: objectPath, title: title.trim(), category: mode === 'analysis' ? 'analysis' : category,
        scene_type: mode === 'analysis' ? sceneType : null,
        scene_minute: mode === 'analysis' && sceneMinute.trim() ? Number(sceneMinute) : null,
        analysis_note: mode === 'analysis' ? analysisNote.trim() || null : null,
        visibility: 'staff',
      });
      if (insertError) throw insertError;
      const { error: uploadError } = await uploadStorageObject('match-videos', objectPath, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) {
        await supabase.from('match_videos').delete().eq('id', id);
        throw new Error(uploadError.message);
      }
      setTitle(''); setSceneMinute(''); setAnalysisNote(''); setAnalysisFilter('all'); setUploadOpen(false); await reload();
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

  const openComposer = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    setError(null);
    setCaption(initialFeedText(video, matchInfo));
    setComposerId(video.id);
    if (video.visibility === 'team') {
      const { data, error: captionError } = await supabase.from('team_feed_posts')
        .select('caption').eq('dedupe_key', `match_video:${video.id}`).maybeSingle();
      if (captionError) setError('Der bisherige Feed-Text konnte nicht geladen werden.');
      else if (data) setCaption(data.caption ?? '');
    }
  };

  const saveDetails = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy || !editTitle.trim()) return;
    setBusy(true); setError(null);
    try {
      const { error: editError } = mode === 'analysis'
        ? await supabase.rpc('update_match_analysis_scene', {
          p_video_id: video.id, p_title: editTitle.trim(), p_scene_type: sceneType,
          p_scene_minute: sceneMinute.trim() ? Number(sceneMinute) : null, p_analysis_note: analysisNote.trim(),
        })
        : await supabase.rpc('update_match_video_details', {
          p_video_id: video.id, p_title: editTitle.trim(), p_category: editCategory,
        });
      if (editError) throw editError;
      setEditingId(null);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Video konnte nicht geändert werden.'); }
    finally { setBusy(false); }
  };

  const publish = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!caption.trim()) { setError('Bitte einen Text für den Feed eingeben.'); return; }
    if (video.visibility === 'staff' && !window.confirm(`„${video.title}“ für Eltern und Spieler dieses Teams freigeben? Fans erhalten keinen Zugriff.`)) return;
    setBusy(true); setError(null);
    const { error: publishError } = await supabase.rpc('publish_match_video', {
      p_video_id: video.id, p_caption: caption.trim(),
    });
    if (publishError) setError(publishError.message);
    else { setComposerId(null); await reload(); }
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

  const deleteVideo = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!window.confirm(`„${video.title}“ endgültig löschen? ${video.visibility === 'team' ? 'Der Beitrag verschwindet auch aus dem Team-Feed. ' : ''}Bereits heruntergeladene Kopien bleiben davon unberührt.`)) return;
    setBusy(true); setError(null);
    try {
      // Withdraw access first, including any feed reference, before removing the file.
      if (video.visibility === 'team') {
        const { error: revokeError } = await supabase.rpc('unpublish_match_video', { p_video_id: video.id });
        if (revokeError) throw revokeError;
      }
      const { error: storageError } = await supabase.storage.from('match-videos').remove([video.object_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from('match_videos').delete().eq('id', video.id);
      if (deleteError) throw deleteError;
      if (playingId === video.id) { setPlayingId(null); setPlayingUrl(null); }
      if (composerId === video.id) setComposerId(null);
      if (editingId === video.id) setEditingId(null);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Video konnte nicht gelöscht werden. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  };

  if (mode === 'analysis') {
    const filters = Object.entries(SCENE_TYPES).filter(([key]) => visibleVideos.some(v => (v.scene_type ?? 'other') === key));
    const matchDate = matchInfo?.dateIso ? new Date(matchInfo.dateIso) : null;
    const hasDate = Boolean(matchDate && !Number.isNaN(matchDate.getTime()));
    const datePart = (options: Intl.DateTimeFormatOptions) => hasDate
      ? new Intl.DateTimeFormat('de-AT', { ...options, timeZone: 'Europe/Vienna' }).format(matchDate as Date).replace('.', '').toUpperCase()
      : '';
    const teamParts = (name: string) => {
      const words = name.trim().split(/\s+/);
      return words.length > 1 && /^[A-ZÄÖÜ0-9]{2,6}$/.test(words[0])
        ? { prefix: words[0], name: words.slice(1).join(' ') }
        : { prefix: '', name };
    };
    const home = teamParts(matchInfo?.homeTeam ?? 'Heim');
    const away = teamParts(matchInfo?.awayTeam ?? 'Gast');
    return <section aria-label="Spielanalyse" className="mx-auto max-w-2xl space-y-5 pb-8 text-white">
      {showResultHeader && <header className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-red-500/30 bg-black/82 shadow-[0_0_40px_rgba(239,68,68,0.18),0_8px_40px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-red-950/65 to-black/85" />
        <div className="relative px-3 pb-3 pt-3 sm:px-4">
          <div className="grid grid-cols-[58px_minmax(0,1fr)_66px] items-center gap-2">
            <div className="flex w-[58px] flex-col items-center border-r border-white/10 pr-2 text-center leading-none">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-red-300">{datePart({ weekday: 'short' })}</span>
              <span className="mt-0.5 text-[30px] font-black tabular-nums text-white">{datePart({ day: '2-digit' }) || '–'}</span>
              <span className="mt-0.5 text-[11px] font-bold uppercase text-white/65">{datePart({ month: 'short' })}</span>
              <span className="mt-0.5 text-[10px] text-white/45">{datePart({ year: 'numeric' })}</span>
            </div>
            <p className="min-w-0 rounded-full border border-red-500/40 bg-red-950/70 px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.08em] text-red-50">{matchInfo?.matchType || 'Meisterschaftsspiel'}</p>
            <span className="rounded-full border border-white/20 bg-white/[0.07] px-2 py-1 text-center text-[9px] font-black uppercase tracking-wider text-white/75">Beendet</span>
          </div>
          <div className="mt-2 flex justify-center"><span className="rounded-full border border-red-500/40 bg-red-950/70 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-50">Endstand</span></div>
          <div className="mt-3 flex items-start justify-between gap-1.5">
            <div className="flex w-[31%] min-w-0 flex-col items-center text-center">
              <img src={matchInfo?.homeLogoUrl || '/logos/placeholder-shield-a.png'} alt="" className="h-[76px] w-[76px] max-w-full object-contain drop-shadow sm:h-24 sm:w-24" onError={e => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = '/logos/placeholder-shield-a.png'; }} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">{home.prefix || ' '}</p>
              <p className={`mt-0.5 w-full min-w-0 text-center font-bold leading-[1.2] text-white ${home.name.length > 13 ? 'text-[12px] sm:text-base' : 'text-[16px] sm:text-lg'}`}>{home.name}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center pt-1 text-center">
              <p className={`whitespace-nowrap font-black leading-none tabular-nums text-white ${!matchInfo?.score || matchInfo.score.length >= 4 ? 'text-[2.65rem] min-[390px]:text-[3.25rem] sm:text-[4rem]' : 'text-[3.2rem] min-[390px]:text-[4rem] sm:text-[4.5rem]'}`}>{matchInfo?.score ?? '–:–'}</p>
              {matchInfo?.periodScore && <p className="mt-0 text-[11px] tabular-nums leading-tight text-white/58">{matchInfo.periodScore}</p>}
            </div>
            <div className="flex w-[31%] min-w-0 flex-col items-center text-center">
              <img src={matchInfo?.awayLogoUrl || '/logos/placeholder-shield-a.png'} alt="" className="h-[76px] w-[76px] max-w-full object-contain drop-shadow sm:h-24 sm:w-24" onError={e => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = '/logos/placeholder-shield-a.png'; }} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">{away.prefix || ' '}</p>
              <p className={`mt-0.5 w-full min-w-0 text-center font-bold leading-[1.2] text-white ${away.name.length > 13 ? 'text-[12px] sm:text-base' : 'text-[16px] sm:text-lg'}`}>{away.name}</p>
            </div>
          </div>
          {matchInfo?.location && <div className="mt-3 flex min-h-11 items-center gap-2 border-t border-white/10 px-1 pt-2.5 text-[14px] font-semibold text-white/68"><MapPin className="h-5 w-5 shrink-0 text-red-400" aria-hidden /><span className="min-w-0 truncate">{matchInfo.location}</span></div>}
        </div>
      </header>}

      {error && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Spielszenen</h2><p className="text-sm text-white/55">{visibleVideos.length} {visibleVideos.length === 1 ? 'hochgeladene Szene' : 'hochgeladene Szenen'}</p></div>
        {canManage && !demoMode && <button type="button" onClick={() => setUploadOpen(open => !open)} aria-expanded={uploadOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/45 bg-red-950/45 px-3 text-sm font-semibold text-red-100"><UploadCloud size={17} aria-hidden /> Szene hinzufügen <ChevronDown size={16} className={uploadOpen ? 'rotate-180' : ''} aria-hidden /></button>}
      </div>

      {canManage && !demoMode && uploadOpen && <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={17} aria-hidden /> Zunächst nur für Trainer sichtbar</p>
        <label className="block text-sm">Titel<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="z. B. Parade in der 12. Minute" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white" /></label>
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <label className="block text-sm">Kategorie<select value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block text-sm">Minute<input type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} placeholder="optional" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white" /></label>
        </div>
        <label className="block text-sm">Trainernotiz (optional)<textarea value={analysisNote} onChange={e => setAnalysisNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base text-white" /></label>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
        <button type="button" disabled={busy || !title.trim() || (sceneMinute.trim() !== '' && (!Number.isInteger(Number(sceneMinute)) || Number(sceneMinute) < 0 || Number(sceneMinute) > 200))} onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-50"><UploadCloud size={18} aria-hidden />{busy ? 'Bitte warten …' : 'Analyseszene hochladen'}</button>
        <p className="text-xs text-white/55">Exportierter Clip · MP4, MOV oder WebM · maximal 150 MB.</p>
      </div>}

      {loading ? <p className="text-sm text-white/60">Spielszenen werden geladen …</p> : visibleVideos.length === 0 ? <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-6 text-sm text-white/65">Hier erscheinen deine Analyseszenen mit Bild und Kategorie, sobald du den ersten Clip hochgeladen hast.</p> : <>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Szenen filtern">
          {[['all', 'Alle'], ...filters].map(([key,label]) => <button key={key} type="button" onClick={() => setAnalysisFilter(key)} aria-pressed={analysisFilter === key} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${analysisFilter === key ? 'border-red-400 bg-red-600 text-white' : 'border-white/15 bg-zinc-900 text-white/75'}`}>{label}</button>)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredVideos.map(video => <article key={video.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_12px_28px_rgba(0,0,0,0.25)]">
            {playingId === video.id && playingUrl ? <video key={playingUrl} src={playingUrl} controls autoPlay playsInline preload="metadata" className="aspect-video w-full bg-black object-contain" /> : <button type="button" onClick={() => void play(video)} aria-label={`${video.title} abspielen`} className="relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-red-950 via-zinc-900 to-black">
              {previewUrls[video.id] && <video src={`${previewUrls[video.id]}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-contain" />}
              <span className="absolute inset-0 flex items-center justify-center bg-black/5"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/45"><Play size={22} fill="white" aria-hidden /></span></span>
              {video.scene_minute != null && <span className="absolute right-2 top-2 rounded-lg bg-black/75 px-2 py-1 text-xs font-semibold">{video.scene_minute}'</span>}
            </button>}
            <div className="flex items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0 space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-red-300">{SCENE_TYPES[video.scene_type ?? 'other'] ?? 'Weitere Szenen'}</p><h3 className="break-words text-base font-bold leading-tight" title={video.title}>{video.title}</h3>{video.analysis_note && <p className="line-clamp-2 text-sm text-white/55">{video.analysis_note}</p>}</div>
              {canManage && !demoMode && <div className="flex shrink-0 gap-1" aria-label="Szene verwalten">
                <button type="button" aria-label={`${video.title} bearbeiten`} title="Bearbeiten" onClick={() => { setEditTitle(video.title); setSceneType(video.scene_type ?? 'other'); setSceneMinute(video.scene_minute?.toString() ?? ''); setAnalysisNote(video.analysis_note ?? ''); setEditingId(video.id); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white"><Pencil size={18} aria-hidden /></button>
                <button type="button" aria-label={`${video.title} löschen`} title="Löschen" disabled={busy} onClick={() => void deleteVideo(video)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={18} aria-hidden /></button>
              </div>}
            </div>
            {editingId === video.id && <div className="space-y-2 border-t border-white/10 p-3 text-sm">
              <input aria-label="Titel" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={120} className="min-h-10 w-full rounded-lg border border-white/15 bg-zinc-900 px-2" />
              <select aria-label="Kategorie" value={sceneType} onChange={e => setSceneType(e.target.value)} className="min-h-10 w-full rounded-lg border border-white/15 bg-zinc-900 px-2">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
              <input aria-label="Spielminute" type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} placeholder="Minute" className="min-h-10 w-full rounded-lg border border-white/15 bg-zinc-900 px-2" />
              <textarea aria-label="Trainernotiz" value={analysisNote} onChange={e => setAnalysisNote(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-lg border border-white/15 bg-zinc-900 p-2" />
              <div className="flex gap-2"><button type="button" disabled={busy || !editTitle.trim() || (sceneMinute.trim() !== '' && (!Number.isInteger(Number(sceneMinute)) || Number(sceneMinute) < 0 || Number(sceneMinute) > 200))} onClick={() => void saveDetails(video)} className="min-h-10 rounded-lg bg-red-600 px-3 disabled:opacity-50">Speichern</button><button type="button" onClick={() => setEditingId(null)} className="min-h-10 rounded-lg border border-white/15 px-2">Abbrechen</button></div>
            </div>}
          </article>)}
        </div>
      </>}
    </section>;
  }

  return <section aria-label={mode === 'analysis' ? 'Spielanalyse' : 'Videos zum Spiel'} className="mx-auto max-w-2xl space-y-4 pb-8 text-white">
    <div className="rounded-2xl border border-red-500/25 bg-gradient-to-b from-red-950/35 to-zinc-950 p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Clapperboard className="text-red-400" aria-hidden /> {mode === 'analysis' ? 'Spielanalyse' : 'Videos zum Spiel'}</h2>
      <p className="mt-1 text-sm text-white/65">{mode === 'analysis' ? 'Analysierte Szenen zu diesem Match. Kennzahlen werden nur aus erfassten Spieldaten angezeigt.' : 'Highlights und Spielszenen zu diesem Match.'}</p>
    </div>

    {canManage && !demoMode && <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={17} aria-hidden /> Neues Video – zunächst nur für Trainer</div>
      <label className="block text-sm">Titel<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="z. B. Alle Highlights" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white" /></label>
      {mode === 'videos' ? <label className="block text-sm">Kategorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base text-white">{Object.entries(CATEGORIES).filter(([value]) => value !== 'analysis').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label> : null}
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      <button type="button" disabled={busy || !title.trim()} onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-50"><UploadCloud size={18} aria-hidden />{busy ? 'Bitte warten …' : mode === 'analysis' ? 'Analyseszene hochladen' : 'Highlight hochladen'}</button>
      <p className="text-xs text-white/55">MP4, MOV oder WebM · maximal 150 MB · kein komplettes Rohspiel.</p>
    </div>}

    {error && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
    {loading ? <p className="text-sm text-white/60">Videos werden geladen …</p> : visibleVideos.length === 0 ? <p className="rounded-xl border border-white/10 p-5 text-sm text-white/70">{mode === 'analysis' ? 'Noch keine Analyseszenen zu diesem Spiel vorhanden.' : 'Noch keine für dich freigegebenen Videos zu diesem Spiel.'}</p> :
      <div className="space-y-3">{visibleVideos.map(video => <article key={video.id} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-medium text-red-300">{CATEGORIES[video.category] ?? 'Video'}</div><h3 className="mt-1 font-semibold">{video.title}</h3></div><span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs">{video.visibility === 'team' ? 'Im Team-Feed' : 'Nur Trainer'}</span></div>
        {canManage && !demoMode && editingId === video.id && <div className="mt-3 space-y-3 rounded-xl border border-white/15 p-3">
          <label className="block text-sm">Titel<input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 text-base text-white" /></label>
          <label className="block text-sm">Kategorie<select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 text-base text-white">{Object.entries(CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !editTitle.trim()} onClick={() => void saveDetails(video)} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold disabled:opacity-50">Speichern</button><button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm">Abbrechen</button></div>
        </div>}
        {playingId === video.id && playingUrl && <video key={playingUrl} src={playingUrl} controls playsInline preload="metadata" className="mt-3 w-full rounded-xl" />}
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void play(video)} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm"><Play size={16} aria-hidden /> Abspielen</button>
          {canManage && !demoMode && <button type="button" disabled={busy} onClick={() => { setEditTitle(video.title); setEditCategory(video.category); setEditingId(video.id); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm disabled:opacity-50"><Pencil size={16} aria-hidden /> Titel bearbeiten</button>}
          {canManage && (video.visibility === 'staff' ? <button type="button" disabled={busy} onClick={() => void openComposer(video)} className="flex min-h-11 items-center gap-2 rounded-xl border border-red-500/50 px-3 text-sm text-red-200 disabled:opacity-50"><Send size={16} aria-hidden /> Im Feed teilen</button> : <button type="button" disabled={busy} onClick={() => void unpublish(video)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm disabled:opacity-50">Freigabe zurücknehmen</button>)}
          {canManage && !demoMode && video.visibility === 'team' && <button type="button" disabled={busy} onClick={() => void openComposer(video)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm disabled:opacity-50">Feed-Text bearbeiten</button>}
          {canManage && !demoMode && <button type="button" disabled={busy} onClick={() => void deleteVideo(video)} className="flex min-h-11 items-center gap-2 rounded-xl border border-red-500/40 px-3 text-sm text-red-200 disabled:opacity-50"><Trash2 size={16} aria-hidden /> Löschen</button>}
        </div>
        {canManage && !demoMode && composerId === video.id && <div className="mt-3 space-y-3 rounded-xl border border-red-500/30 bg-zinc-950 p-3">
          <label className="block text-sm">Text für den Team-Feed<textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base text-white" /></label>
          <p className="text-xs text-white/60">Sichtbar für Eltern und Spieler dieses Teams. Fans erhalten keinen Zugriff.</p>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !caption.trim()} onClick={() => void publish(video)} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold disabled:opacity-50">{video.visibility === 'team' ? 'Feed-Text speichern' : 'Im Team-Feed veröffentlichen'}</button><button type="button" onClick={() => setComposerId(null)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm">Abbrechen</button></div>
        </div>}
      </article>)}</div>}
  </section>;
};
