import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, LockKeyhole, MoreVertical, Pencil, Play, Plus, Send, Trash2, UploadCloud, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadStorageObject } from '../../lib/storageUpload';

type Chapter = { id: string; second: number; kind: string; title: string };

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
  chapters: Chapter[];
  visibility: 'staff' | 'team';
  created_at: string;
};

const CATEGORIES: Record<string, string> = {
  highlights: 'Highlights', goals: 'Tore', chances: 'Schüsse / Chancen',
  defence: 'Abwehr', player: 'Spielerszene', analysis: 'Spielanalyse',
};
const SCENE_TYPES: Record<string, string> = {
  goal: 'Tore', shot: 'Schüsse', save: 'Paraden', corner: 'Ecken', defence: 'Abwehr', other: 'Weitere Szenen',
};
const chapterTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
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
  onBack?: () => void;
  matchInfo?: {
    homeTeam: string;
    awayTeam: string;
    homeLogoUrl?: string | null;
    awayLogoUrl?: string | null;
    date?: string;
    dateIso?: string | null;
    matchType?: string;
    ageGroup?: string | null;
    periodScore?: string;
    location?: string | null;
    score?: string;
  };
};

const initialFeedText = (video: MatchVideo, matchInfo?: Props['matchInfo']) => {
  const lines = [video.title.trim()];
  if (video.scene_minute != null) lines.push(`Spielminute: ${video.scene_minute}`);
  if (video.analysis_note?.trim()) lines.push(video.analysis_note.trim());
  if (matchInfo?.homeTeam && matchInfo.awayTeam) lines.push(`${matchInfo.homeTeam} – ${matchInfo.awayTeam}`);
  if (matchInfo?.date) lines.push(`Spiel vom ${matchInfo.date}`);
  if (matchInfo?.score) lines.push(`Endstand: ${matchInfo.score}`);
  if (matchInfo?.location?.trim()) lines.push(`Spielort: ${matchInfo.location.trim()}`);
  return lines.join('\n').slice(0, 500);
};

export const MatchVideosPanel: React.FC<Props> = ({ matchId, teamSeasonId, canManage, demoMode = false, matchInfo, mode = 'videos', showResultHeader = true, onBack }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('highlights');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [chapterKind, setChapterKind] = useState('other');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterQuery, setChapterQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [chapterBusy, setChapterBusy] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('highlights');
  const [composerId, setComposerId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [sceneType, setSceneType] = useState('other');
  const [sceneMinute, setSceneMinute] = useState('');
  const [analysisNote, setAnalysisNote] = useState('');
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [view, setView] = useState<'highlights' | 'scenes' | 'analysis'>(mode === 'analysis' ? 'scenes' : 'highlights');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const sceneView = view !== 'highlights';
  const visibleVideos = videos.filter(video => sceneView ? video.category === 'analysis' : video.category !== 'analysis');
  const filteredVideos = sceneView && analysisFilter !== 'all'
    ? visibleVideos.filter(video => (video.scene_type ?? 'other') === analysisFilter)
    : visibleVideos;
  const orderedVideos = [...filteredVideos].sort((a, b) => sceneView
    ? (a.scene_minute ?? Infinity) - (b.scene_minute ?? Infinity)
    : Number(/^alle highlights$/i.test(b.title.trim())) - Number(/^alle highlights$/i.test(a.title.trim())));
  // Imported scene clips form a playlist; exported complete highlight reels remain separate.
  const sequenceVideos = videos.filter(video => video.category !== 'highlights').sort((a, b) =>
    (a.scene_minute ?? Infinity) - (b.scene_minute ?? Infinity) || a.created_at.localeCompare(b.created_at));
  const playlistVideos = playlistIds.map(id => videos.find(video => video.id === id)).filter((video): video is MatchVideo => Boolean(video));
  const playlistKind = (video: MatchVideo) => video.category === 'analysis'
    ? (video.scene_type && video.scene_type !== 'other' ? video.scene_type : /\btor(?:\s*\d+)?\b/i.test(video.title) ? 'goal' : 'other')
    : video.category === 'goals' ? 'goal' : video.category === 'chances' ? 'shot'
    : video.category === 'defence' ? 'defence' : 'other';
  const matchingPlaylistVideos = playlistVideos.filter(video =>
    (chapterFilter === 'all' || playlistKind(video) === chapterFilter) &&
    `${video.title} ${SCENE_TYPES[playlistKind(video)] ?? ''}`.toLocaleLowerCase('de').includes(chapterQuery.trim().toLocaleLowerCase('de')));
  const activeScene = videos.find(video => video.id === playingId);
  const chapters = [...(activeScene?.chapters ?? [])].sort((a, b) => a.second - b.second);
  const matchingChapters = chapters.filter(chapter => (chapterFilter === 'all' || chapter.kind === chapterFilter) && `${chapter.title} ${SCENE_TYPES[chapter.kind] ?? ''}`.toLocaleLowerCase('de').includes(chapterQuery.trim().toLocaleLowerCase('de')));
  const videoLabel = (video: MatchVideo) => video.category === 'analysis'
    ? SCENE_TYPES[video.scene_type ?? 'other'] ?? 'Weitere Szenen'
    : CATEGORIES[video.category] ?? 'Highlights';
  const switchView = (next: typeof view) => {
    setActionsId(null); setView(next); setAnalysisFilter('all'); setUploadOpen(false); setEditingId(null); setComposerId(null);
  };
  useEffect(() => { switchView(mode === 'analysis' ? 'scenes' : 'highlights'); }, [mode, matchId]);

  useEffect(() => {
    if (!playingId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPlayingId(null); setPlayingUrl(null); }
    };
    window.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onEscape); };
  }, [playingId]);

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('match_videos')
      .select('id,match_id,team_season_id,object_path,title,category,scene_type,scene_minute,analysis_note,chapters,visibility,created_at')
      .eq('match_id', matchId).order('created_at', { ascending: false });
    if (loadError) setError('Spielvideos konnten nicht geladen werden. Ist die Datenbank-Erweiterung bereits eingerichtet?');
    else {
      const loaded = (data ?? []) as MatchVideo[];
      setVideos(loaded); setError(null);
      {
        const previews = await Promise.all(loaded.map(async video => {
          const { data: signed } = await supabase.storage.from('match-videos').createSignedUrl(video.object_path, 600);
          return [video.id, signed?.signedUrl ?? ''] as const;
        }));
        setPreviewUrls(Object.fromEntries(previews));
      }
    }
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
        object_path: objectPath, title: title.trim(), category: sceneView ? 'analysis' : category,
        scene_type: sceneView ? sceneType : null,
        scene_minute: sceneView && sceneMinute.trim() ? Number(sceneMinute) : null,
        analysis_note: sceneView ? analysisNote.trim() || null : null,
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

  const play = async (video: MatchVideo, keepPlaylist = false) => {
    setPlayingId(null); setPlayingUrl(null); setError(null); setChapterError(null);
    if (!keepPlaylist) { setPlaylistIds([]); setChapterQuery(''); setChapterFilter('all'); }
    setChapterTitle('');
    const { data, error: signError } = await supabase.storage.from('match-videos')
      .createSignedUrl(video.object_path, 300);
    if (signError || !data?.signedUrl) {
      setError('Video derzeit nicht verfügbar oder keine Freigabe.');
      return;
    }
    setPlayingId(video.id); setPlayingUrl(data.signedUrl);
  };

  const playPlaylist = () => {
    if (sequenceVideos.length === 0) return;
    setPlaylistIds(sequenceVideos.map(video => video.id));
    setChapterQuery(''); setChapterFilter('all');
    void play(sequenceVideos[0], true);
  };

  const nextPlaylistScene = () => {
    const index = playlistIds.indexOf(playingId ?? '');
    const next = videos.find(video => video.id === playlistIds[index + 1]);
    if (next) void play(next, true);
  };

  const jumpToChapter = (second: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = second;
    void player.play().catch(() => {});
  };

  const changeChapter = async (video: MatchVideo, action: 'add' | 'delete', id?: string) => {
    if (!canManage || demoMode || chapterBusy || video.category === 'analysis') return;
    const second = Math.floor(playerRef.current?.currentTime ?? 0);
    if (action === 'add' && (!Number.isFinite(second) || second < 0 || second > 3600)) {
      setChapterError('Bitte eine Stelle im Highlight bis 60 Minuten auswählen.');
      return;
    }
    setChapterBusy(true); setChapterError(null);
    const { data, error: saveError } = await supabase.rpc('change_match_video_chapter', {
      p_video_id: video.id, p_action: action, p_chapter_id: id ?? null,
      p_second: action === 'add' ? second : null,
      p_kind: action === 'add' ? chapterKind : null,
      p_title: action === 'add' ? chapterTitle.trim() || SCENE_TYPES[chapterKind] : null,
    });
    if (saveError) setChapterError(saveError.message);
    else {
      setVideos(current => current.map(item => item.id === video.id ? { ...item, chapters: (data ?? []) as Chapter[] } : item));
      if (action === 'add') setChapterTitle('');
    }
    setChapterBusy(false);
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
      const { error: editError } = video.category === 'analysis'
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

  const filters = Object.entries(SCENE_TYPES);
  const resultPeriods = matchInfo?.periodScore && !/[–—-]/.test(matchInfo.periodScore) ? matchInfo.periodScore : null;
  const teamLabel = (team: string) => {
    const parts = team.trim().match(/^([A-ZÄÖÜ]{2,6})\s+(.+)$/);
    return parts ? { prefix: parts[1], name: parts[2] } : { prefix: '', name: team.trim() };
  };
  const validMinute = sceneMinute.trim() === '' || (Number.isInteger(Number(sceneMinute)) && Number(sceneMinute) >= 0 && Number(sceneMinute) <= 200);
  const sceneFields = <>
    <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
      <label className="block text-sm">Kategorie<select aria-label="Szenenkategorie" value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm">Minute<input type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} placeholder="optional" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
    </div>
    <label className="block text-sm">Trainerkommentar<textarea value={analysisNote} onChange={e => setAnalysisNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base" /></label>
  </>;
  return <section aria-label="Spielvideos" className="mx-auto max-w-2xl space-y-3 pb-[calc(100px+env(safe-area-inset-bottom,0px))] text-white">
    {showResultHeader && matchInfo && <header className="relative overflow-hidden rounded-3xl border border-[rgb(var(--club-border-rgb)/0.3)] bg-[linear-gradient(145deg,rgb(var(--club-primary-rgb)/0.25),#08080a_44%,rgb(var(--club-primary-rgb)/0.16))] px-3 py-3 shadow-[0_10px_40px_rgb(var(--club-primary-rgb)/0.14)] sm:p-5">
      {onBack && <button type="button" onClick={onBack} aria-label="Zurück zum Livespiel" className="absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/65 hover:bg-white/10"><ArrowLeft size={18} aria-hidden /></button>}
      <div className="px-9 text-center">
        {matchInfo.ageGroup && <p className="text-lg font-black uppercase tracking-[0.12em] text-red-400">{matchInfo.ageGroup}</p>}
        <p className="mt-1 text-lg font-extrabold uppercase tracking-wide text-white sm:text-xl">{(matchInfo.matchType || 'Spielvideos').replace(/^Meisterschaftsspiel$/i, 'Meisterschaft')}</p>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-1">
        {[matchInfo.homeTeam, matchInfo.awayTeam].map((team, index) => <React.Fragment key={index}>
          {index === 1 && <div className="min-w-0 pt-1 text-center">
            {matchInfo.date && <p className="whitespace-nowrap text-[11px] font-medium text-white/65 sm:text-sm">{matchInfo.date}</p>}
            <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-white sm:text-xs">{matchInfo.score ? 'Endstand' : 'Ergebnis offen'}</p>
            <p className="mt-1 whitespace-nowrap text-[clamp(2.25rem,11.5vw,4rem)] font-black leading-none tracking-tight tabular-nums text-white">{matchInfo.score?.replace(/\s/g, '') || '–:–'}</p>
            {resultPeriods && <p className="mt-1 break-words text-[10px] font-semibold tabular-nums text-white/60 sm:text-xs">{resultPeriods}</p>}
          </div>}
          <div className="flex min-w-0 flex-col items-center text-center">
            <img src={(index === 0 ? matchInfo.homeLogoUrl : matchInfo.awayLogoUrl) || '/logos/placeholder-shield-a.png'} alt="" className="h-[4.75rem] w-[4.75rem] min-[390px]:h-20 min-[390px]:w-20 object-contain [filter:drop-shadow(0_0_12px_rgba(255,255,255,0.16))] sm:h-24 sm:w-24" onError={e => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = '/logos/placeholder-shield-a.png'; }} />
            {teamLabel(team).prefix && <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white">{teamLabel(team).prefix}</p>}
            <h2 className={`mt-0.5 w-full font-extrabold leading-tight text-white sm:text-base ${teamLabel(team).name.length >= 13 ? 'text-[11px] min-[390px]:text-xs tracking-tight' : 'text-sm'}`} style={{overflowWrap:'normal'}}>{teamLabel(team).name}</h2>
          </div>
        </React.Fragment>)}
      </div>
      {matchInfo.location && <p className="mt-2 border-t border-white/10 pt-2 text-sm font-medium text-white/75">{matchInfo.location}</p>}
    </header>}
    <nav aria-label="Videoansicht" className="grid grid-cols-3 border-b border-white/10">
      {([['highlights','Highlights'],['scenes','Spielszenen'],['analysis','Analyse']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => switchView(key)} aria-pressed={view === key} className={`min-h-11 min-w-0 border-b-2 px-1 text-xs font-extrabold uppercase tracking-wide sm:text-sm ${view === key ? 'border-red-500 text-red-400' : 'border-transparent text-white/70'}`}>{label}</button>)}
    </nav>
    {error && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
    <div className="flex items-center justify-between gap-2">
      <div><h2 className="text-xl font-bold">{view === 'highlights' ? 'Highlights' : view === 'scenes' ? 'Spielszenen' : 'Spielanalyse'}</h2><p className="text-xs text-white/55">{visibleVideos.length} {sceneView ? 'Szenen' : 'Videos'}</p></div>
      {canManage && !demoMode && <button type="button" onClick={() => setUploadOpen(open => !open)} aria-expanded={uploadOpen} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-red-500/60 bg-red-950/70 px-3 text-sm font-bold"><Plus size={18} aria-hidden /> {sceneView ? 'Szene' : 'Video'} </button>}
    </div>
    {canManage && !demoMode && uploadOpen && <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={17} aria-hidden /> Zunächst nur für Trainer sichtbar</p>
      {!sceneView && <label className="block text-sm">Pro-Soccer-Export<select aria-label="Highlight-Vorlage" defaultValue="" onChange={e => {
        const preset = e.target.value; if (!preset) return;
        setTitle(preset); setCategory(preset.startsWith('Tor-') ? 'goals' : preset.startsWith('Schuss-') ? 'chances' : preset.startsWith('Defensiv-') ? 'defence' : 'highlights');
      }} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base"><option value="">Vorlage auswählen (optional)</option>{['Alle Highlights','Tor-Highlights','Schuss-Highlights','Paraden-Highlights','Angriffs-Highlights','Defensiv-Highlights'].map(label => <option key={label}>{label}</option>)}</select></label>}
      <label className="block text-sm">Titel<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={sceneView ? 'z. B. Parade in der 18. Minute' : 'z. B. Alle Highlights'} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
      {sceneView ? sceneFields : <label className="block text-sm">Kategorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(CATEGORIES).filter(([key]) => key !== 'analysis').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      <button type="button" disabled={busy || !title.trim() || (sceneView && !validMinute)} onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-50"><UploadCloud size={18} aria-hidden />{busy ? 'Bitte warten …' : 'Video auswählen und hochladen'}</button>
      <p className="text-xs text-white/55">MP4, MOV oder WebM · maximal 150 MB pro Video.</p>
    </div>}
    {view === 'highlights' && sequenceVideos.length > 0 && <div className="space-y-2 rounded-2xl border border-red-500/30 bg-red-950/30 p-4">
      <h3 className="text-lg font-bold">Highlights aus Spielszenen</h3>
      <p className="text-sm text-white/70">{sequenceVideos.length} Clips aus diesem Spiel nacheinander abspielen. Neue Clips erscheinen automatisch in der Liste.</p>
      <button type="button" onClick={playPlaylist} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 font-bold"><Play size={18} fill="white" aria-hidden /> Alle abspielen</button>
    </div>}
    {view === 'analysis' && <p className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-white/65">Szenen und Trainerkommentare zu diesem Spiel. Ein automatischer Import des technischen Pro-Soccer-Berichts ist noch nicht eingerichtet.</p>}
    {sceneView && filters.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Szenen filtern">{[['all','Alle'],...filters].map(([key,label]) => <button key={key} type="button" onClick={() => setAnalysisFilter(key)} aria-pressed={analysisFilter === key} className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold ${analysisFilter === key ? 'border-red-400/50 bg-red-800' : 'border-white/15 bg-zinc-950 text-white/70'}`}>{label}</button>)}</div>}
    {loading ? <p className="text-sm text-white/60">Videos werden geladen …</p> : orderedVideos.length === 0 ? <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-6 text-sm text-white/65">{canManage ? 'Noch keine Videos in diesem Bereich. Über + Szene oder + Video kannst du deinen ersten Export hochladen.' : 'Noch keine freigegebenen Videos in diesem Bereich.'}</p> :
      <div className={sceneView ? 'space-y-4' : 'grid grid-cols-2 gap-3'}>{orderedVideos.map((video, index) => <article key={video.id} className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 ${sceneView ? 'grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-center gap-1 p-1.5' : index === 0 ? 'col-span-2' : ''} ${editingId === video.id || composerId === video.id ? 'col-span-2' : ''}`}>
        {canManage && !demoMode && <button type="button" onClick={() => setActionsId(current => current === video.id ? null : video.id)} aria-label={`${video.title}: Aktionen`} aria-expanded={actionsId === video.id} className="absolute right-0 top-0 z-10 flex h-11 w-8 items-center justify-center rounded-lg text-white/65 hover:bg-white/10"><MoreVertical size={19} aria-hidden /></button>}
        <button type="button" onClick={() => {setActionsId(null);void play(video);}} aria-label={`${video.title} abspielen`} className="relative isolate block aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-red-950 via-zinc-900 to-black">
          {previewUrls[video.id] && <video src={`${previewUrls[video.id]}#t=0.1`} muted playsInline preload="metadata" onLoadedMetadata={e => {
            const seconds = e.currentTarget.duration;
            if (Number.isFinite(seconds)) setDurations(current => ({...current,[video.id]: `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`}));
          }} className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" />}
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center [transform:translateZ(0)]"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/45"><Play size={20} fill="white" aria-hidden /></span></span>
          {durations[video.id] && <span className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-lg bg-black/80 px-2 py-1 text-xs tabular-nums">{durations[video.id]}</span>}
          {video.scene_minute != null && <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-lg bg-black/80 px-2 py-1 text-xs">{video.scene_minute}. Minute</span>}
        </button>
        <div className={`min-w-0 space-y-2 p-3 ${canManage && !demoMode ? 'pr-7' : ''} ${sceneView && (editingId === video.id || composerId === video.id) ? 'col-span-2' : ''}`}>
          <h3 className="break-words text-sm font-bold leading-tight sm:text-base">{video.title}</h3>
          {sceneView && <p className="text-xs text-white/65">{video.scene_minute != null && <span>{video.scene_minute}′ · </span>}{videoLabel(video)}</p>}
          {video.analysis_note && <p className={`whitespace-pre-wrap break-words text-sm text-white/60 ${view === 'analysis' ? '' : 'line-clamp-2'}`}>{video.analysis_note}</p>}
          {canManage && !demoMode && video.visibility === 'staff' && <p className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs text-white/65"><LockKeyhole size={12} className="shrink-0" aria-hidden />Nur Trainer</p>}
          {canManage && !demoMode && actionsId === video.id && <>
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={busy} aria-label={`${video.title} bearbeiten`} title="Bearbeiten" onClick={() => {setActionsId(null);setEditingId(video.id);setEditTitle(video.title);setEditCategory(video.category);setSceneType(video.scene_type ?? 'other');setSceneMinute(video.scene_minute?.toString() ?? '');setAnalysisNote(video.analysis_note ?? '');setComposerId(null);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 disabled:opacity-50"><Pencil size={17} aria-hidden /></button>
              <button type="button" disabled={busy} aria-label={`${video.title} im Feed teilen`} title="Im Feed teilen" onClick={() => {setActionsId(null);setEditingId(null);void openComposer(video);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/35 text-red-300 disabled:opacity-50"><Send size={17} aria-hidden /></button>
              <button type="button" disabled={busy} aria-label={`${video.title} löschen`} title="Löschen" onClick={() => {setActionsId(null);void deleteVideo(video);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/35 text-red-300 disabled:opacity-50"><Trash2 size={17} aria-hidden /></button>
            </div>
            {video.visibility === 'team' && <button type="button" disabled={busy} onClick={() => void unpublish(video)} className="min-h-11 text-xs text-white/60 disabled:opacity-50">Freigabe zurücknehmen</button>}
          </>}
          {canManage && !demoMode && editingId === video.id && <div className="space-y-3 border-t border-white/10 pt-3">
            <label className="block text-sm">Titel<input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
            {video.category === 'analysis' ? sceneFields : <label className="block text-sm">Kategorie<select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(CATEGORIES).filter(([key]) => key !== 'analysis').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
            <div className="flex gap-2"><button type="button" disabled={busy || !editTitle.trim() || (video.category === 'analysis' && !validMinute)} onClick={() => void saveDetails(video)} className="min-h-11 rounded-xl bg-red-600 px-3 text-sm disabled:opacity-50">Speichern</button><button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">Abbrechen</button></div>
          </div>}
          {canManage && !demoMode && composerId === video.id && <div className="space-y-3 border-t border-white/10 pt-3">
            <label className="block text-sm">Text für den Team-Feed<textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} rows={4} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base" /></label>
            <p className="text-xs text-white/60">Für Eltern und Spieler dieses Teams. Fans erhalten keinen Zugriff.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !caption.trim()} onClick={() => void publish(video)} className="min-h-11 rounded-xl bg-red-600 px-3 text-sm disabled:opacity-50">{video.visibility === 'team' ? 'Feed-Text speichern' : 'Im Team-Feed veröffentlichen'}</button><button type="button" onClick={() => setComposerId(null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">Abbrechen</button></div>
          </div>}
        </div>
      </article>)}</div>}
    {activeScene && playingUrl && createPortal(<div className="fixed inset-0 z-[11000] flex flex-col bg-zinc-950 text-white" role="dialog" aria-modal="true" aria-label={`${activeScene.title} abspielen`}>
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top,0px)]"><div className="min-w-0"><p className="text-xs text-red-400">{videoLabel(activeScene)}</p><h2 className="truncate text-lg font-bold">{activeScene.title}</h2></div><button type="button" onClick={() => {setPlayingId(null);setPlayingUrl(null);setPlaylistIds([]);}} aria-label="Video schließen" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/20"><X size={22} aria-hidden /></button></div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black"><video ref={playerRef} key={playingUrl} src={playingUrl} controls autoPlay playsInline preload="metadata" onEnded={nextPlaylistScene} className="max-h-full w-full object-contain" /></div>
        {(playlistIds.length > 0 || activeScene.category !== 'analysis') && <aside className="flex max-h-[45vh] min-h-0 w-full flex-col border-t border-white/15 bg-zinc-950 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0" aria-label="Szenen im Highlight">
          <div className="space-y-2 border-b border-white/10 p-3">
            <h3 className="font-bold">{playlistIds.length > 0 ? 'Szenen im Spiel' : 'Szenen im Highlight'}</h3>
            <input type="search" value={chapterQuery} onChange={e => setChapterQuery(e.target.value)} placeholder="Szene suchen" aria-label="Szene suchen" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base" />
            <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)} aria-label="Szenen filtern" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base">
              <option value="all">Alle Szenen</option>{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          {playlistIds.length > 0 ? <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {matchingPlaylistVideos.length === 0 ? <p className="p-3 text-sm text-white/60">Keine passende Szene gefunden.</p> : matchingPlaylistVideos.map(video => <button key={video.id} type="button" onClick={() => void play(video, true)} aria-current={video.id === playingId ? 'true' : undefined} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${video.id === playingId ? 'bg-red-900/50' : 'hover:bg-white/10'}`}>
              <span className="shrink-0 font-bold tabular-nums text-red-400">{video.scene_minute != null ? `${video.scene_minute}′` : `${playlistIds.indexOf(video.id) + 1}.`}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{video.title}</span><span className="text-xs text-white/55">{SCENE_TYPES[playlistKind(video)] ?? 'Weitere Szenen'}</span></span>
            </button>)}
          </div> : <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {chapters.length === 0 ? <p className="p-3 text-sm text-white/60">Noch keine Zeitmarken. Trainer können Szenen beim Abspielen markieren.</p> : matchingChapters.length === 0 ? <p className="p-3 text-sm text-white/60">Keine passende Szene gefunden.</p> : matchingChapters.map(chapter => <div key={chapter.id} className="flex items-center gap-1 rounded-xl hover:bg-white/10">
              <button type="button" onClick={() => jumpToChapter(chapter.second)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm" aria-label={`Zu ${chapterTime(chapter.second)} ${chapter.title} springen`}>
                <span className="shrink-0 font-bold tabular-nums text-red-400">{chapterTime(chapter.second)}</span>
                <span className="min-w-0 truncate">{chapter.title}</span>
              </button>
              {canManage && !demoMode && <button type="button" disabled={chapterBusy} onClick={() => void changeChapter(activeScene, 'delete', chapter.id)} aria-label={`Zeitmarke ${chapter.title} löschen`} className="flex min-h-11 min-w-11 items-center justify-center text-white/60 disabled:opacity-50"><Trash2 size={16} aria-hidden /></button>}
            </div>)}
          </div>}
          {canManage && !demoMode && playlistIds.length === 0 && <div className="space-y-2 border-t border-white/10 p-3">
            <p className="text-xs text-white/65">Video an der gewünschten Stelle pausieren, dann markieren.</p>
            <select value={chapterKind} onChange={e => setChapterKind(e.target.value)} aria-label="Kategorie der neuen Szene" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} maxLength={80} placeholder="Titel (optional)" aria-label="Titel der neuen Szene" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base" />
            <button type="button" disabled={chapterBusy} onClick={() => void changeChapter(activeScene, 'add')} className="min-h-11 w-full rounded-xl bg-red-600 px-3 font-semibold disabled:opacity-50">{chapterBusy ? 'Speichert …' : 'Aktuelle Stelle markieren'}</button>
            {chapterError && <p role="alert" className="text-sm text-amber-300">{chapterError}</p>}
          </div>}
        </aside>}
      </div>
      {activeScene.analysis_note && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm text-white/70">{activeScene.analysis_note}</p>}
      <div className="pb-[env(safe-area-inset-bottom,0px)]" />
    </div>,document.body)}
  </section>;
};
