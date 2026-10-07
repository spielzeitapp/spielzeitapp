import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, List, LockKeyhole, Maximize2, Minimize2, MoreVertical, Pencil, Play, Plus, Send, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { MatchVideoTransferActions } from './MatchVideoTransferActions';
import { uploadStorageObject } from '../../lib/storageUpload';

type Chapter = { id: string; second: number; kind: string; title: string; player_id?: string | null; assist_player_id?: string | null; match_event_id?: string | null };
type MatchPlayer = { id: string; first_name: string; last_name: string; jersey_number: number | null };
type GoalEvent = { id: string; minute: number | null; player_id: string | null; type: string; created_at: string };

type MatchVideo = {
  id: string;
  match_id: string;
  team_season_id: string;
  object_path: string;
  title: string;
  category: string;
  scene_type: string | null;
  scene_minute: number | null;
  scene_player_id: string | null;
  assist_player_id: string | null;
  linked_match_event_id: string | null;
  analysis_note: string | null;
  chapters: Chapter[];
  visibility: 'staff' | 'team';
  created_at: string;
};

const CATEGORIES: Record<string, string> = {
  highlights: 'Highlights', goals: 'Tore', chances: 'Schüsse / Chancen',
  defence: 'Abwehr', player: 'Spielerszene', scenes: 'Spielszenen', analysis: 'Once / Analyse',
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
  wide?: boolean;
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

export const MatchVideosPanel: React.FC<Props> = ({ matchId, teamSeasonId, canManage, demoMode = false, matchInfo, mode = 'videos', showResultHeader = true, wide = false, onBack }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const playRequestRef = useRef(0);
  useEffect(() => () => { playRequestRef.current += 1; }, []);
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('highlights');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState('Alle Highlights');
  const [theaterMode, setTheaterMode] = useState(false);
  const [theaterScenesOpen, setTheaterScenesOpen] = useState(false);
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
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([]);
  const [editTitleAuto, setEditTitleAuto] = useState(false);
  const [uploadTitleAuto, setUploadTitleAuto] = useState(false);
  const [annotationPlayerId, setAnnotationPlayerId] = useState('');
  const [annotationAssistId, setAnnotationAssistId] = useState('');
  const [annotationEventId, setAnnotationEventId] = useState('');
  const [chapterEditId, setChapterEditId] = useState<string | null>(null);
  const [chapterEditTitle, setChapterEditTitle] = useState('');
  const [chapterManageOpen, setChapterManageOpen] = useState(false);
  const [view, setView] = useState<'highlights' | 'scenes' | 'analysis'>(mode === 'analysis' ? 'scenes' : 'highlights');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareUpload, setShareUpload] = useState(true);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const sceneView = view !== 'highlights';
  const sceneKind = (video: MatchVideo) => video.scene_type && video.scene_type !== 'other'
    ? video.scene_type : /^(?:\d+:\d+\s+)?tor(?:\s*\d+)?\b/i.test(video.title.trim()) ? 'goal' : 'other';
  const visibleVideos = videos.filter(video => view === 'highlights' ? video.category !== 'analysis' && video.category !== 'scenes'
    : video.category === view);
  const filteredVideos = view === 'scenes' && analysisFilter !== 'all'
    ? visibleVideos.filter(video => sceneKind(video) === analysisFilter)
    : visibleVideos;
  const byMinute = (a: MatchVideo, b: MatchVideo) =>
    (a.scene_minute ?? Infinity) - (b.scene_minute ?? Infinity) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  const orderedVideos = [...filteredVideos].sort((a, b) =>
    (sceneView ? 0 : Number(/^alle highlights$/i.test(b.title.trim())) - Number(/^alle highlights$/i.test(a.title.trim()))) || byMinute(a, b));
  // Individual scene clips form the playlist. Already edited exports remain separate.
  const sequenceVideos = videos.filter(video => video.category !== 'analysis' && !/^(?:alle|tor|schuss|paraden|angriffs|defensiv)[\s-]*highlights$/i.test(video.title.trim())).sort(byMinute);
  const playlistVideos = playlistIds.map(id => videos.find(video => video.id === id)).filter((video): video is MatchVideo => Boolean(video));
  const playlistKind = (video: MatchVideo) => video.category === 'scenes' ? sceneKind(video)
    : video.category === 'goals' ? 'goal' : video.category === 'chances' ? 'shot'
    : video.category === 'defence' ? 'defence' : sceneKind(video);
  const matchingPlaylistVideos = playlistVideos.filter(video =>
    (chapterFilter === 'all' || playlistKind(video) === chapterFilter) &&
    `${video.title} ${SCENE_TYPES[playlistKind(video)] ?? ''} ${matchPlayers.find(p => p.id === video.scene_player_id)?.first_name ?? ''} ${matchPlayers.find(p => p.id === video.scene_player_id)?.last_name ?? ''}`.toLocaleLowerCase('de').includes(chapterQuery.trim().toLocaleLowerCase('de')));
  const activeScene = videos.find(video => video.id === playingId);
  const showSceneList = Boolean(activeScene && (playlistIds.length > 0 || (activeScene.category !== 'analysis' && activeScene.category !== 'scenes')));
  const chapters = [...(activeScene?.chapters ?? [])].sort((a, b) => a.second - b.second);
  const activeChapterId = [...chapters].reverse().find(chapter => chapter.second <= currentSecond)?.id;
  const matchingChapters = chapters.filter(chapter => (chapterFilter === 'all' || chapter.kind === chapterFilter) && `${chapter.title} ${SCENE_TYPES[chapter.kind] ?? ''} ${matchPlayers.find(p => p.id === chapter.player_id)?.first_name ?? ''} ${matchPlayers.find(p => p.id === chapter.player_id)?.last_name ?? ''}`.toLocaleLowerCase('de').includes(chapterQuery.trim().toLocaleLowerCase('de')));
  const videoLabel = (video: MatchVideo) => video.category === 'scenes'
    ? SCENE_TYPES[sceneKind(video)] ?? 'Weitere Szenen'
    : CATEGORIES[video.category] ?? 'Highlights';
  const switchView = (next: typeof view) => {
    setActionsId(null); setView(next); setAnalysisFilter('all'); setUploadOpen(false); setUploadTitleAuto(false); setTitle(''); setEditingId(null); setComposerId(null);
  };
  useEffect(() => { switchView(mode === 'analysis' ? 'analysis' : 'highlights'); }, [mode, matchId]);

  useEffect(() => {
    if (!playingId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (theaterMode) { setTheaterMode(false); setTheaterScenesOpen(false); }
        else { playRequestRef.current += 1; setPlayingId(null); setPlayingUrl(null); setPlaylistIds([]); }
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onEscape); };
  }, [playingId, theaterMode]);

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('match_videos')
      .select('id,match_id,team_season_id,object_path,title,category,scene_type,scene_minute,scene_player_id,assist_player_id,linked_match_event_id,analysis_note,chapters,visibility,created_at')
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

  useEffect(() => {
    if (!canManage || demoMode) return;
    let cancelled = false;
    const loadMatchPlayers = async () => {
      const [playersResult, squadResult, goalsResult] = await Promise.all([
        supabase.from('players').select('id,first_name,last_name,jersey_number').eq('team_season_id', teamSeasonId).order('last_name'),
        supabase.from('match_squad_publications').select('selected_player_ids').eq('match_id', matchId).maybeSingle(),
        supabase.from('match_events').select('id,minute,player_id,type,created_at').eq('match_id', matchId).in('type', ['goal', 'goal_away']).order('minute').order('created_at').order('id'),
      ]);
      if (cancelled) return;
      const ids = squadResult.data?.selected_player_ids as string[] | undefined;
      setMatchPlayers(((playersResult.data ?? []) as MatchPlayer[]).filter(p => !ids || ids.includes(p.id)));
      setGoalEvents((goalsResult.data ?? []) as GoalEvent[]);
    };
    void loadMatchPlayers();
    return () => { cancelled = true; };
  }, [canManage, demoMode, matchId, teamSeasonId]);

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
        object_path: objectPath, title: title.trim(), category: view === 'highlights' ? category : view,
        scene_type: view !== 'analysis' ? sceneType : null,
        scene_minute: view !== 'analysis' && sceneMinute.trim() ? Number(sceneMinute) : null,
        analysis_note: view === 'scenes' ? analysisNote.trim() || null : null,
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
      if (view !== 'analysis' && (annotationPlayerId || annotationAssistId || annotationEventId)) {
        await annotateScene({ id } as MatchVideo, null, title.trim());
      }
      if (shareUpload) {
        const { error: releaseError } = await supabase.rpc('release_match_video', { p_video_id: id });
        if (releaseError) throw new Error('Video hochgeladen, aber noch nicht freigegeben. Bitte am Clip auf Freigeben tippen.');
      }
      setTitle(''); setSceneMinute(''); setAnalysisNote(''); setAnnotationPlayerId(''); setAnnotationAssistId(''); setAnnotationEventId(''); setAnalysisFilter('all'); setUploadOpen(false); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const play = async (video: MatchVideo, keepPlaylist = false) => {
    // Keep the dialog and video element mounted while the next signed URL loads.
    const request = ++playRequestRef.current;
    setError(null); setChapterError(null);
    if (!keepPlaylist) { setPlaylistIds([]); setPlaylistTitle('Alle Highlights'); setChapterQuery(''); setChapterFilter('all'); setTheaterMode(false); setTheaterScenesOpen(false); }
    setChapterTitle(''); setChapterEditId(null); setChapterManageOpen(false);
    const { data, error: signError } = await supabase.storage.from('match-videos')
      .createSignedUrl(video.object_path, 300);
    if (request !== playRequestRef.current) return;
    if (signError || !data?.signedUrl) {
      setError('Video derzeit nicht verfügbar oder keine Freigabe.');
      return;
    }
    setCurrentSecond(0); setPlayingId(video.id); setPlayingUrl(data.signedUrl);
  };

  const playPlaylist = (kind: 'all' | 'goal' | 'save') => {
    const selected = kind === 'all' ? sequenceVideos : sequenceVideos.filter(video => playlistKind(video) === kind);
    if (selected.length === 0) return;
    setPlaylistTitle(kind === 'goal' ? 'Tor-Highlights' : kind === 'save' ? 'Paraden-Highlights' : 'Spiel-Highlights');
    setPlaylistIds(selected.map(video => video.id));
    setChapterQuery(''); setChapterFilter('all');
    void play(selected[0], true);
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
    setCurrentSecond(second);
    setTheaterScenesOpen(false);
    void player.play().catch(() => {});
  };

  const changeChapter = async (video: MatchVideo, action: 'add' | 'delete', id?: string) => {
    if (!canManage || demoMode || chapterBusy || video.category === 'analysis' || video.category === 'scenes') return;
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

  // Only derive an intermediate score when the recorded goal timeline agrees with
  // the final result. A partial import must never invent a score for a clip.
  const finalScore = matchInfo?.score?.match(/^(\d+):(\d+)$/);
  const recordedHomeGoals = goalEvents.filter(event => event.type === 'goal').length;
  const recordedAwayGoals = goalEvents.filter(event => event.type === 'goal_away').length;
  const completeGoalTimeline = Boolean(finalScore && Number(finalScore[1]) === recordedHomeGoals && Number(finalScore[2]) === recordedAwayGoals);
  const scoreByGoalId = new Map<string, string>();
  if (completeGoalTimeline) {
    let home = 0;
    let away = 0;
    for (const event of goalEvents) {
      if (event.type === 'goal') home += 1;
      else if (event.type === 'goal_away') away += 1;
      scoreByGoalId.set(event.id, `${home}:${away}`);
    }
  }

  const playerName = (id?: string | null) => {
    const player = matchPlayers.find(item => item.id === id);
    return player ? `${player.first_name} ${player.last_name}` : '';
  };

  const suggestSceneTitle = (kind: string, playerId: string, assistId: string) => {
    const label = ({ goal: 'Tor', shot: 'Schuss', save: 'Parade', corner: 'Ecke', defence: 'Abwehraktion', other: 'Spielszene' } as Record<string, string>)[kind] ?? 'Spielszene';
    const score = kind === 'goal' ? scoreByGoalId.get(annotationEventId) : null;
    return `${label}${score ? ` zum ${score}` : ''}${playerName(playerId) ? ` – ${playerName(playerId)}` : ''}${kind === 'goal' && playerName(assistId) ? ` (Vorlage: ${playerName(assistId)})` : ''}`;
  };

  useEffect(() => {
    if (!uploadOpen || view === 'analysis' || !uploadTitleAuto) return;
    setTitle(suggestSceneTitle(sceneType, annotationPlayerId, annotationAssistId));
  }, [uploadOpen, view, uploadTitleAuto, sceneType, annotationPlayerId, annotationAssistId, annotationEventId, matchPlayers, goalEvents, matchInfo?.score]);

  useEffect(() => {
    if (!editingId || !editTitleAuto) return;
    setEditTitle(suggestSceneTitle(sceneType, annotationPlayerId, annotationAssistId));
  }, [editingId, editTitleAuto, sceneType, annotationPlayerId, annotationAssistId, annotationEventId, matchPlayers, goalEvents, matchInfo?.score]);

  const annotateScene = async (video: MatchVideo, chapterId: string | null, sceneTitle: string) => {
    const { data, error: annotationError } = await supabase.rpc('annotate_match_video_scene', {
      p_video_id: video.id, p_chapter_id: chapterId, p_title: sceneTitle.trim(),
      p_kind: sceneType, p_player_id: annotationPlayerId || null,
      p_assist_player_id: sceneType === 'goal' ? annotationAssistId || null : null,
      p_match_event_id: sceneType === 'goal' ? annotationEventId || null : null,
    });
    if (annotationError) throw new Error(annotationError.message);
    if (chapterId) setVideos(current => current.map(item => item.id === video.id ? { ...item, chapters: (data ?? []) as Chapter[] } : item));
  };

  const saveChapterDetails = async (video: MatchVideo) => {
    if (!chapterEditId || !chapterEditTitle.trim() || chapterBusy || !canManage || demoMode) return;
    setChapterBusy(true); setChapterError(null);
    try { await annotateScene(video, chapterEditId, chapterEditTitle); setChapterEditId(null); }
    catch (e) { setChapterError(e instanceof Error ? e.message : 'Zeitmarke konnte nicht geändert werden.'); }
    finally { setChapterBusy(false); }
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
    if (!canManage || demoMode || busy || !editTitle.trim() || (video.category !== 'analysis' && !validMinute)) return;
    setBusy(true); setError(null);
    try {
      const { error: editError } = await supabase.rpc('save_match_video_scene', {
        p_video_id: video.id, p_title: editTitle.trim(), p_category: editCategory,
        p_kind: sceneType, p_scene_minute: sceneMinute.trim() ? Number(sceneMinute) : null,
        p_analysis_note: analysisNote.trim(), p_player_id: annotationPlayerId || null,
        p_assist_player_id: sceneType === 'goal' ? annotationAssistId || null : null,
        p_match_event_id: sceneType === 'goal' ? annotationEventId || null : null,
      });
      if (editError) throw new Error(editError.message);
      setEditingId(null);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Video konnte nicht geändert werden.'); }
    finally { setBusy(false); }
  };

  const publish = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!caption.trim()) { setError('Bitte einen Text für den Feed eingeben.'); return; }
    if (video.visibility === 'staff' && !window.confirm(`„${video.title}“ für Eltern, Spieler und Fans dieses Teams freigeben?`)) return;
    setBusy(true); setError(null);
    const { error: publishError } = await supabase.rpc('publish_match_video', {
      p_video_id: video.id, p_caption: caption.trim(),
    });
    if (publishError) setError(publishError.message);
    else { setComposerId(null); await reload(); }
    setBusy(false);
  };

  const release = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    setBusy(true); setError(null);
    try {
      const { error: releaseError } = await supabase.rpc('release_match_video', { p_video_id: video.id });
      if (releaseError) throw releaseError;
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Freigabe fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const unpublish = async (video: MatchVideo) => {
    if (!canManage || demoMode || busy) return;
    if (!window.confirm('Freigabe zurücknehmen und Feed-Beitrag entfernen? Bereits heruntergeladene Kopien bleiben davon unberührt.')) return;
    setBusy(true); setError(null); playRequestRef.current += 1; setPlayingUrl(null); setPlayingId(null);
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
      if (playingId === video.id) { playRequestRef.current += 1; setPlayingId(null); setPlayingUrl(null); }
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
  const participantFields = <>
    <label className="block text-sm">Spieler aus dem Matchkader<select value={annotationPlayerId} onChange={e => {setAnnotationPlayerId(e.target.value);setAnnotationEventId('');if (e.target.value === annotationAssistId) setAnnotationAssistId('');}} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base"><option value="">Ohne Spielerzuordnung</option>{matchPlayers.map(player => <option key={player.id} value={player.id}>{player.first_name} {player.last_name}{player.jersey_number != null ? ` · #${player.jersey_number}` : ''}</option>)}</select></label>
    {sceneType === 'goal' && <>
      <label className="block text-sm">Vorlage (optional)<select value={annotationAssistId} onChange={e => setAnnotationAssistId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base"><option value="">Keine Vorlage zuordnen</option>{matchPlayers.filter(player => player.id !== annotationPlayerId).map(player => <option key={player.id} value={player.id}>{player.first_name} {player.last_name}</option>)}</select></label>
      <label className="block text-sm">Vorhandenes Tor verknüpfen (optional)<select value={annotationEventId} onChange={e => {
        setAnnotationEventId(e.target.value);
        const event = goalEvents.find(item => item.id === e.target.value);
        if (event?.minute != null) setSceneMinute(String(Math.ceil(event.minute / 60)));
      }} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base"><option value="">Kein Torereignis verknüpft</option>{goalEvents.filter(event => event.type === 'goal' && (!event.player_id || event.player_id === annotationPlayerId)).map(event => <option key={event.id} value={event.id}>{scoreByGoalId.get(event.id) ? `${scoreByGoalId.get(event.id)} · ` : ''}{event.minute == null ? '–' : `${Math.ceil(event.minute / 60)}′`} · {playerName(event.player_id) || 'Tor ohne Torschützen'}</option>)}</select></label>
    </>}
    <p className="text-xs text-white/55">Videozuordnungen verändern die Torstatistik nicht. Ein bestehendes Tor kannst du oben verknüpfen.</p>
  </>;
  const sceneFields = <>
    <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
      <label className="block text-sm">Kategorie<select aria-label="Szenenkategorie" value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm">Minute<input type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} placeholder="optional" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
    </div>
    <label className="block text-sm">Trainerkommentar<textarea value={analysisNote} onChange={e => setAnalysisNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base" /></label>
  </>;
  return <section aria-label="Spielvideos" className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-2xl'} space-y-3 pb-[calc(100px+env(safe-area-inset-bottom,0px))] text-white`}>
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
      <div><h2 className="text-xl font-bold">{view === 'highlights' ? 'Highlights' : view === 'scenes' ? 'Spielszenen' : 'Spielanalyse'}</h2><p className="text-xs text-white/55">{visibleVideos.length} {sceneView ? 'Szenen' : 'Videos'}{view !== 'analysis' && ' · nach Spielminute sortiert'}</p></div>
      {canManage && !demoMode && <button type="button" onClick={() => { const opening = !uploadOpen; setUploadOpen(opening); if (opening) setShareUpload(view !== 'analysis'); setUploadTitleAuto(opening && view === 'scenes' && !title.trim()); }} aria-expanded={uploadOpen} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-red-500/60 bg-red-950/70 px-3 text-sm font-bold"><Plus size={18} aria-hidden /> {view === 'scenes' ? 'Szene' : view === 'analysis' ? 'Analyse' : 'Video'} </button>}
    </div>
    {canManage && !demoMode && uploadOpen && <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={shareUpload} onChange={e => setShareUpload(e.target.checked)} className="mt-1 h-4 w-4" /><span>Für Eltern, Spieler und Fans freigeben<span className="mt-1 block text-xs text-white/60">Mit Download und Teilen. Ohne Häkchen bleibt das Video nur für Trainer sichtbar.</span></span></label>
      {!sceneView && <label className="block text-sm">Pro-Soccer-Export<select aria-label="Highlight-Vorlage" defaultValue="" onChange={e => {
        const preset = e.target.value; if (!preset) return;
        setTitle(preset); setCategory(preset.startsWith('Tor-') ? 'goals' : preset.startsWith('Schuss-') ? 'chances' : preset.startsWith('Defensiv-') ? 'defence' : 'highlights');
      }} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base"><option value="">Vorlage auswählen (optional)</option>{['Alle Highlights','Tor-Highlights','Schuss-Highlights','Paraden-Highlights','Angriffs-Highlights','Defensiv-Highlights'].map(label => <option key={label}>{label}</option>)}</select></label>}
      <label className="block text-sm">Titel<input value={title} onChange={e => { setUploadTitleAuto(false); setTitle(e.target.value); }} maxLength={120} placeholder={view === 'scenes' ? 'z. B. Parade in der 18. Minute' : view === 'analysis' ? 'z. B. Once Spielanalyse' : 'z. B. Alle Highlights'} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
      {view === 'scenes' ? sceneFields : view === 'analysis' ? null : <><label className="block text-sm">Kategorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(CATEGORIES).filter(([key]) => key !== 'analysis' && key !== 'scenes').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block text-sm">Szenenart<select value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block text-sm">Spielminute (optional)<input type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label></>}
      {view !== 'analysis' && <div className="space-y-2">{participantFields}<button type="button" onClick={() => { setUploadTitleAuto(true); setTitle(suggestSceneTitle(sceneType, annotationPlayerId, annotationAssistId)); }} className="min-h-11 rounded-xl border border-red-500/40 px-3 text-sm text-red-300">Titel aus Szene vorschlagen</button></div>}
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      <button type="button" disabled={busy || !title.trim() || (view !== 'analysis' && !validMinute)} onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold disabled:opacity-50"><UploadCloud size={18} aria-hidden />{busy ? 'Bitte warten …' : 'Video auswählen und hochladen'}</button>
      <p className="text-xs text-white/55">MP4, MOV oder WebM · maximal 150 MB pro Video.</p>
    </div>}
    {view === 'highlights' && sequenceVideos.length > 0 && <div className="space-y-2" aria-label="Highlight-Auswahl">
      {([['all', 'Spiel-Highlights', sequenceVideos.length], ['goal', 'Tor-Highlights', sequenceVideos.filter(video => playlistKind(video) === 'goal').length], ['save', 'Paraden-Highlights', sequenceVideos.filter(video => playlistKind(video) === 'save').length]] as const).filter(([, , count]) => count > 0).map(([kind, label, count]) =>
        <button key={kind} type="button" onClick={() => playPlaylist(kind)} className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-red-500/35 bg-red-950/30 p-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600"><Play size={18} fill="white" aria-hidden /></span>
          <span className="min-w-0"><span className="block font-bold">{label} abspielen</span><span className="block text-sm text-white/65">{count} {count === 1 ? 'Clip' : 'Clips'} nacheinander · Szenen auswählen</span></span>
        </button>)}
      <p className="px-1 text-xs text-white/55">Neue Spielszenen erscheinen automatisch. Eltern, Spieler und Fans sehen freigegebene Clips und können sie herunterladen oder teilen.</p>
    </div>}
    {view === 'analysis' && <p className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-white/65">Bearbeitete Videos und Auswertungen, zum Beispiel Exporte aus Once. Die Analyse entsteht dort; hier kannst du das Ergebnis zum Spiel speichern und für das Team freigeben.</p>}
    {view === 'scenes' && filters.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Szenen filtern">{[['all','Alle'],...filters].map(([key,label]) => <button key={key} type="button" onClick={() => setAnalysisFilter(key)} aria-pressed={analysisFilter === key} className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold ${analysisFilter === key ? 'border-red-400/50 bg-red-800' : 'border-white/15 bg-zinc-950 text-white/70'}`}>{label}</button>)}</div>}
    {loading ? <p className="text-sm text-white/60">Videos werden geladen …</p> : orderedVideos.length === 0 ? <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-6 text-sm text-white/65">{view === 'analysis' ? 'Noch keine bearbeitete Analyse hochgeladen.' : canManage ? 'Noch keine Clips in diesem Bereich. Mit + Video oder + Szene kannst du einen Clip hochladen.' : 'Noch keine freigegebenen Videos in diesem Bereich.'}</p> :
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
          {video.scene_player_id && <p className="text-xs text-red-300">{playerName(video.scene_player_id)}{video.assist_player_id && ` · Vorlage: ${playerName(video.assist_player_id)}`}</p>}
          {video.analysis_note && <p className={`whitespace-pre-wrap break-words text-sm text-white/60 ${view === 'analysis' ? '' : 'line-clamp-2'}`}>{video.analysis_note}</p>}
          {canManage && !demoMode && video.visibility === 'staff' && <p className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs text-white/65"><LockKeyhole size={12} className="shrink-0" aria-hidden />Nur Trainer</p>}
          {video.visibility === 'team' && <p className="text-xs text-emerald-300">Für Eltern, Spieler und Fans freigegeben</p>}
          {canManage && !demoMode && video.visibility === 'staff' && <button type="button" disabled={busy} onClick={() => void release(video)} className="min-h-11 rounded-xl border border-emerald-500/40 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-50">Freigeben</button>}
          {canManage && !demoMode && actionsId === video.id && <>
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={busy} aria-label={`${video.title} bearbeiten`} title="Bearbeiten" onClick={() => {setActionsId(null);setEditingId(video.id);setEditTitle(video.title);setEditTitleAuto(!video.title.trim() || /^(?:Tor(?: zum \d+:\d+)?|Schuss|Parade|Ecke|Abwehraktion|Spielszene)(?:\s*[–-]\s*.+)?$/i.test(video.title.trim()));setEditCategory(video.category);setSceneType(video.scene_type ?? 'other');setSceneMinute(video.scene_minute?.toString() ?? '');setAnalysisNote(video.analysis_note ?? '');setAnnotationPlayerId(video.scene_player_id ?? '');setAnnotationAssistId(video.assist_player_id ?? '');setAnnotationEventId(video.linked_match_event_id ?? '');setComposerId(null);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 disabled:opacity-50"><Pencil size={17} aria-hidden /></button>
              <button type="button" disabled={busy} aria-label={`${video.title} im Feed teilen`} title="Im Feed teilen" onClick={() => {setActionsId(null);setEditingId(null);void openComposer(video);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/35 text-red-300 disabled:opacity-50"><Send size={17} aria-hidden /></button>
              <button type="button" disabled={busy} aria-label={`${video.title} löschen`} title="Löschen" onClick={() => {setActionsId(null);void deleteVideo(video);}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/35 text-red-300 disabled:opacity-50"><Trash2 size={17} aria-hidden /></button>
            </div>
            {video.visibility === 'team' && <button type="button" disabled={busy} onClick={() => void unpublish(video)} className="min-h-11 text-xs text-white/60 disabled:opacity-50">Freigabe zurücknehmen</button>}
          </>}
          {canManage && !demoMode && editingId === video.id && <div className="space-y-3 border-t border-white/10 pt-3">
            <label className="block text-sm">Titel<input value={editTitle} onChange={e => { setEditTitleAuto(false); setEditTitle(e.target.value); }} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>
            {video.category === 'scenes' ? sceneFields : video.category === 'analysis' ? null : <label className="block text-sm">Kategorie<select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(CATEGORIES).filter(([key]) => key !== 'analysis' && key !== 'scenes').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
            {video.category !== 'analysis' && <div className="space-y-2">
              {video.category !== 'scenes' && <label className="block text-sm">Szenentyp<select value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
              {video.category !== 'scenes' && <label className="block text-sm">Spielminute (optional)<input type="number" min="0" max="200" value={sceneMinute} onChange={e => setSceneMinute(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 text-base" /></label>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editTitleAuto} onChange={e => setEditTitleAuto(e.target.checked)} />Titel automatisch aus der Zuordnung aktualisieren</label>
              {participantFields}
              <button type="button" onClick={() => { setEditTitleAuto(true); setEditTitle(suggestSceneTitle(sceneType, annotationPlayerId, annotationAssistId)); }} className="min-h-11 rounded-xl border border-red-500/40 px-3 text-sm text-red-300">Titel vorschlagen</button>
            </div>}
            <div className="flex gap-2"><button type="button" disabled={busy || !editTitle.trim() || (video.category !== 'analysis' && !validMinute)} onClick={() => void saveDetails(video)} className="min-h-11 rounded-xl bg-red-600 px-3 text-sm disabled:opacity-50">Speichern</button><button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">Abbrechen</button></div>
          </div>}
          {canManage && !demoMode && composerId === video.id && <div className="space-y-3 border-t border-white/10 pt-3">
            <label className="block text-sm">Text für den Team-Feed<textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} rows={4} className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-base" /></label>
            <p className="text-xs text-white/60">Für Eltern, Spieler und Fans dieses Teams.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !caption.trim()} onClick={() => void publish(video)} className="min-h-11 rounded-xl bg-red-600 px-3 text-sm disabled:opacity-50">{video.visibility === 'team' ? 'Feed-Text speichern' : 'Im Team-Feed veröffentlichen'}</button><button type="button" onClick={() => setComposerId(null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">Abbrechen</button></div>
          </div>}
        </div>
        {!demoMode && <MatchVideoTransferActions objectPath={video.object_path} title={video.title} className={sceneView ? 'col-span-2' : ''} />}
      </article>)}</div>}
    {activeScene && playingUrl && createPortal(<div className="fixed inset-0 z-[11000] flex flex-col bg-zinc-950 text-white" role="dialog" aria-modal="true" aria-label={`${activeScene.title} abspielen`}>
      {theaterMode && <div className="flex min-h-14 items-center justify-between gap-2 border-b border-white/10 bg-zinc-950 px-3 pt-[env(safe-area-inset-top,0px)]">
        <button type="button" onClick={() => {setTheaterMode(false);setTheaterScenesOpen(false);}} aria-label="App-Vollbild verlassen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"><ArrowLeft size={22} aria-hidden /></button>
        <div className="flex items-center gap-2">
          {showSceneList && <button type="button" onClick={() => setTheaterScenesOpen(open => !open)} aria-expanded={theaterScenesOpen} aria-controls="match-video-scenes" className="flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 font-semibold text-white"><List size={19} aria-hidden /> Szenen</button>}
          <button type="button" onClick={() => {setTheaterMode(false);setTheaterScenesOpen(false);}} aria-label="App-Vollbild verkleinern" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white"><Minimize2 size={20} aria-hidden /></button>
        </div>
      </div>}
      {!theaterMode && <div className="flex min-h-16 items-center gap-2 border-b border-white/10 px-3 pt-[env(safe-area-inset-top,0px)]">
        <button type="button" onClick={() => {playRequestRef.current += 1;setPlayingId(null);setPlayingUrl(null);setPlaylistIds([]);}} aria-label="Zurück zu Spielvideos" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"><ArrowLeft size={22} aria-hidden /></button>
        <div className="min-w-0 flex-1 text-center"><p className="text-xs text-red-400">{videoLabel(activeScene)}</p><h2 className="truncate text-lg font-bold">{playlistIds.length > 0 ? playlistTitle : activeScene.title}</h2></div><span className="w-11 shrink-0" aria-hidden />
      </div>}
      <div className={theaterMode ? 'relative flex min-h-0 flex-1 bg-black' : 'relative flex min-h-0 flex-1 flex-col landscape:flex-row'}>
        <div className={`relative flex min-h-0 min-w-0 items-center justify-center bg-black ${theaterMode ? `flex-1 ${theaterScenesOpen && showSceneList ? 'landscape:mr-[38%]' : ''}` : showSceneList ? 'aspect-video w-full shrink-0 landscape:aspect-auto landscape:w-auto landscape:flex-1 landscape:shrink' : 'flex-1'}`}>
          <video ref={playerRef} src={playingUrl} controls autoPlay playsInline preload="auto" onLoadedMetadata={e => { void e.currentTarget.play().catch(() => {}); }} onEnded={nextPlaylistScene} onTimeUpdate={e => setCurrentSecond(Math.floor(e.currentTarget.currentTime))} className="h-full w-full object-contain" />
          {error && <p role="alert" className="absolute bottom-16 left-3 right-3 rounded-xl bg-zinc-900/95 p-3 text-sm text-amber-100">{error}</p>}
          {!theaterMode && <button type="button" onClick={() => {setTheaterMode(true);setTheaterScenesOpen(false);}} aria-label="App-Vollbild mit Szenenauswahl anzeigen" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/30"><Maximize2 size={20} aria-hidden /></button>}
        </div>
        {showSceneList && (!theaterMode || theaterScenesOpen) && <aside id="match-video-scenes" className={theaterMode ? 'absolute bottom-0 right-0 z-20 flex max-h-[55vh] w-full flex-col border-t border-white/20 bg-zinc-950/95 shadow-2xl landscape:top-0 landscape:max-h-none landscape:h-full landscape:w-[38%] landscape:max-w-[420px] landscape:border-l landscape:border-t-0' : 'flex min-h-0 w-full flex-1 flex-col border-t border-white/15 bg-zinc-950 landscape:h-full landscape:w-[38%] landscape:max-w-[420px] landscape:flex-none landscape:border-l landscape:border-t-0'} aria-label="Szenen im Highlight">
          <div className="space-y-2 border-b border-white/10 p-3">
            <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{playlistIds.length > 0 ? 'Szenen im Spiel' : 'Szenen im Highlight'}</h3>{theaterMode && <button type="button" onClick={() => setTheaterScenesOpen(false)} className="min-h-11 rounded-lg px-3 text-sm text-white/75">Schließen</button>}</div>
            <input type="search" value={chapterQuery} onChange={e => setChapterQuery(e.target.value)} placeholder="Szene suchen" aria-label="Szene suchen" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base" />
            <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)} aria-label="Szenen filtern" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base">
              <option value="all">Alle Szenen</option>{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          {playlistIds.length > 0 ? <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {matchingPlaylistVideos.length === 0 ? <p className="p-3 text-sm text-white/60">Keine passende Szene gefunden.</p> : matchingPlaylistVideos.map(video => <button key={video.id} type="button" onClick={() => {setTheaterScenesOpen(false);void play(video, true);}} aria-current={video.id === playingId ? 'true' : undefined} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${video.id === playingId ? 'bg-red-900/50' : 'hover:bg-white/10'}`}>
              <span className="shrink-0 font-bold tabular-nums text-red-400">{video.scene_minute != null ? `${video.scene_minute}′` : `${playlistIds.indexOf(video.id) + 1}.`}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{video.title}</span><span className="text-xs text-white/55">{SCENE_TYPES[playlistKind(video)] ?? 'Weitere Szenen'}</span></span>
            </button>)}
          </div> : <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {chapters.length === 0 ? <p className="p-3 text-sm text-white/60">Noch keine Zeitmarken. Trainer können Szenen beim Abspielen markieren.</p> : matchingChapters.length === 0 ? <p className="p-3 text-sm text-white/60">Keine passende Szene gefunden.</p> : matchingChapters.map(chapter => <div key={chapter.id} className={`flex items-center gap-1 rounded-xl ${chapter.id === activeChapterId ? 'bg-white/15' : 'hover:bg-white/10'}`}>
              <button type="button" onClick={() => jumpToChapter(chapter.second)} aria-current={chapter.id === activeChapterId ? 'true' : undefined} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm" aria-label={`Zu ${chapterTime(chapter.second)} ${chapter.title} springen`}>
                <span className="shrink-0 font-bold tabular-nums text-red-400">{chapterTime(chapter.second)}</span>
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                {chapter.id === activeChapterId && <span aria-hidden className="text-lg">✓</span>}
              </button>
              {canManage && !demoMode && !theaterMode && <button type="button" onClick={() => {setChapterEditId(chapter.id);setChapterEditTitle(chapter.title);setSceneType(chapter.kind);setAnnotationPlayerId(chapter.player_id ?? '');setAnnotationAssistId(chapter.assist_player_id ?? '');setAnnotationEventId(chapter.match_event_id ?? '');setChapterManageOpen(false);}} aria-label={`Zeitmarke ${chapter.title} bearbeiten`} className="flex min-h-11 min-w-11 items-center justify-center text-white/60"><Pencil size={16} aria-hidden /></button>}
              {canManage && !demoMode && !theaterMode && <button type="button" disabled={chapterBusy} onClick={() => void changeChapter(activeScene, 'delete', chapter.id)} aria-label={`Zeitmarke ${chapter.title} löschen`} className="flex min-h-11 min-w-11 items-center justify-center text-white/60 disabled:opacity-50"><Trash2 size={16} aria-hidden /></button>}
            </div>)}
            {chapterEditId && !theaterMode && <div className="space-y-2 rounded-xl border border-red-500/35 bg-zinc-900 p-3">
              <h4 className="font-semibold">Zeitmarke bearbeiten</h4>
              <label className="block text-sm">Szenentyp<select value={sceneType} onChange={e => setSceneType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-zinc-950 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              {participantFields}
              <label className="block text-sm">Titel<input value={chapterEditTitle} onChange={e => setChapterEditTitle(e.target.value)} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-zinc-950 px-3 text-base" /></label>
              <button type="button" onClick={() => setChapterEditTitle(suggestSceneTitle(sceneType, annotationPlayerId, annotationAssistId))} className="min-h-11 rounded-xl border border-red-500/40 px-3 text-sm text-red-300">Titel vorschlagen</button>
              <div className="flex gap-2"><button type="button" disabled={chapterBusy || !chapterEditTitle.trim()} onClick={() => void saveChapterDetails(activeScene)} className="min-h-11 rounded-xl bg-red-600 px-3 font-semibold disabled:opacity-50">Speichern</button><button type="button" onClick={() => setChapterEditId(null)} className="min-h-11 rounded-xl border border-white/20 px-3">Abbrechen</button></div>
              {chapterError && <p role="alert" className="text-sm text-amber-300">{chapterError}</p>}
            </div>}
          </div>}
          {canManage && !demoMode && !theaterMode && playlistIds.length === 0 && <div className="space-y-2 border-t border-white/10 p-3">
            <button type="button" onClick={() => setChapterManageOpen(open => !open)} aria-expanded={chapterManageOpen} className="min-h-11 w-full rounded-xl border border-red-500/40 px-3 text-left text-sm font-semibold text-red-300">{chapterManageOpen ? 'Bearbeitung schließen' : '+ Szene markieren'}</button>
            {chapterManageOpen && <div className="space-y-2">
            <p className="text-xs text-white/65">Video an der gewünschten Stelle pausieren, dann markieren.</p>
            <select value={chapterKind} onChange={e => setChapterKind(e.target.value)} aria-label="Kategorie der neuen Szene" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base">{Object.entries(SCENE_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} maxLength={80} placeholder="Titel (optional)" aria-label="Titel der neuen Szene" className="min-h-11 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 text-base" />
            <button type="button" disabled={chapterBusy} onClick={() => void changeChapter(activeScene, 'add')} className="min-h-11 w-full rounded-xl bg-red-600 px-3 font-semibold disabled:opacity-50">{chapterBusy ? 'Speichert …' : 'Aktuelle Stelle markieren'}</button>
            {chapterError && <p role="alert" className="text-sm text-amber-300">{chapterError}</p>}
            </div>}
          </div>}
        </aside>}
      </div>
      {!theaterMode && activeScene.analysis_note && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm text-white/70">{activeScene.analysis_note}</p>}
      {!theaterMode && <div className="pb-[env(safe-area-inset-bottom,0px)]" />}
    </div>,document.body)}
  </section>;
};
