import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Clapperboard, ImagePlus, Send, Trophy, Video, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadStorageObject } from '../../lib/storageUpload';
import { membershipRoleForStorageMetadata } from '../../lib/storageUploadMetadata';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

const TEAM_FEED_BUCKET = 'team-feed' as const;

function sanitizeTeamFeedObjectPathSegment(teamSeasonId: string): string | null {
  const s = teamSeasonId.trim().replace(/^\/+|\/+$/g, '');
  if (!s || s.includes('/') || /\s/.test(s)) return null;
  return s;
}

function extForMime(mime: string, kind: 'image' | 'video'): string {
  if (kind === 'image') {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

type Props = {
  backendRole: string;
  /** Rohrolle aus memberships für aktuelle team_season_id (z. B. trainer, co_trainer). */
  membershipRole: string | null;
  teamSeasonId: string;
  teamId: string;
  userId: string | null;
  onPosted: () => void;
};

export const HomeFeedComposer: React.FC<Props> = ({
  backendRole,
  membershipRole,
  teamSeasonId,
  teamId,
  userId,
  onPosted,
}) => {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftKind, setDraftKind] = useState<'image' | 'video' | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startFakeUploadProgress = useCallback(() => {
    clearProgressTimer();
    setUploadPct(4);
    progressTimerRef.current = window.setInterval(() => {
      setUploadPct((p) => (p < 88 ? p + Math.max(2, Math.round((92 - p) / 14)) : p));
    }, 160);
  }, [clearProgressTimer]);

  const clearDraft = useCallback(() => {
    setDraftFile(null);
    setDraftKind(null);
    setError(null);
    setUploadPct(0);
  }, []);

  const onPickImage = useCallback(() => {
    setError(null);
    imgInputRef.current?.click();
  }, []);

  const onPickVideo = useCallback(() => {
    setError(null);
    vidInputRef.current?.click();
  }, []);

  const onImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!IMAGE_TYPES.has(f.type)) {
      setError('Nur JPG, PNG oder WebP.');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('Bild maximal 10 MB.');
      return;
    }
    setDraftFile(f);
    setDraftKind('image');
  }, []);

  const onVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!VIDEO_TYPES.has(f.type)) {
      setError('Nur MP4, MOV oder WebM.');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError('Video maximal 150 MB.');
      return;
    }
    setDraftFile(f);
    setDraftKind('video');
  }, []);

  const publish = useCallback(async () => {
    if (!draftFile || !draftKind || busy) return;
    if (!userId) {
      setError('Bitte neu anmelden, dann erneut versuchen.');
      return;
    }
    if (!IMAGE_TYPES.has(draftFile.type) && !VIDEO_TYPES.has(draftFile.type)) {
      setError('Dateityp nicht erlaubt.');
      return;
    }
    if (draftKind === 'image' && draftFile.size > MAX_IMAGE_BYTES) {
      setError('Bild maximal 10 MB.');
      return;
    }
    if (draftKind === 'video' && draftFile.size > MAX_VIDEO_BYTES) {
      setError('Video maximal 150 MB.');
      return;
    }

    setError(null);
    setBusy(true);
    setPhase('uploading');
    startFakeUploadProgress();

    const folder = draftKind === 'video' ? 'videos' : 'images';
    const ext = extForMime(draftFile.type, draftKind);
    const seasonSeg = sanitizeTeamFeedObjectPathSegment(teamSeasonId);
    if (!seasonSeg) {
      setError('Ungültige team_season_id für den Speicherpfad.');
      setBusy(false);
      setPhase('idle');
      setUploadPct(0);
      clearProgressTimer();
      return;
    }
    const objectPath = `${folder}/${seasonSeg}/${crypto.randomUUID()}.${ext}`.replace(/\/+/g, '/');

    const contentType =
      draftFile.type && draftFile.type.trim() !== ''
        ? draftFile.type
        : draftKind === 'image'
          ? 'image/jpeg'
          : 'video/mp4';

    const fileForUpload =
      draftFile.type && draftFile.type.trim() !== ''
        ? draftFile
        : new File([draftFile], draftFile.name, { type: contentType });

    try {
      console.warn('[HomeFeedComposer][storage-upload] vor Upload', {
        bucket: TEAM_FEED_BUCKET,
        path: objectPath,
        file_name: draftFile.name,
        file_type: draftFile.type,
        file_size: draftFile.size,
        contentType,
      });

      const { error: upErr } = await uploadStorageObject(TEAM_FEED_BUCKET, objectPath, fileForUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType,
        membershipRole: membershipRoleForStorageMetadata(membershipRole),
      });
      if (upErr) {
        const se = upErr as {
          message: string;
          status?: number;
          statusCode?: string;
          error?: string;
          details?: string;
        };
        console.error('[HomeFeedComposer][storage-upload] fehlgeschlagen', {
          message: se.message,
          statusCode: se.statusCode,
          status: se.status,
          error: se.error,
          details: se.details,
        });
        throw new Error(se.message);
      }

      clearProgressTimer();
      setUploadPct(92);
      setPhase('saving');

      const cap = caption.trim() || (draftKind === 'video' ? 'Neues Video' : 'Neues Foto');
      const dedupeKey = `manual:${crypto.randomUUID()}`;
      const insertPayload = {
        team_season_id: teamSeasonId,
        team_id: teamId,
        event_id: null,
        post_kind: draftKind === 'video' ? 'trainer_video' : 'trainer_image',
        caption: cap,
        payload: { storage_path: objectPath },
        dedupe_key: dedupeKey,
        media_type: draftKind,
        media_url: objectPath,
        thumbnail_url: null,
        duration_seconds: null,
        created_by: userId,
      };

      const { data: authSnap } = await supabase.auth.getSession();
      const authUid = authSnap?.session?.user?.id ?? null;
      const rlsDebug = {
        auth_uid: authUid,
        backendRole,
        membershipRole,
        team_id: teamId,
        team_season_id: teamSeasonId,
      };
      console.warn('[HomeFeedComposer][RLS-debug] kontext', rlsDebug);
      console.warn('[HomeFeedComposer][RLS-debug] insertPayload', JSON.stringify(insertPayload, null, 2));

      const { error: insErr } = await supabase.from('team_feed_posts').insert(insertPayload);
      if (insErr) {
        console.error('[HomeFeedComposer][RLS-debug] insert fehlgeschlagen', {
          message: insErr.message,
          code: insErr.code,
          details: insErr.details,
          hint: insErr.hint,
        });
        await supabase.storage.from(TEAM_FEED_BUCKET).remove([objectPath]).catch(() => undefined);
        throw new Error(insErr.message);
      }

      setUploadPct(100);
      setCaption('');
      clearDraft();
      setComposerExpanded(false);
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearProgressTimer();
      setBusy(false);
      setPhase('idle');
      setUploadPct(0);
    }
  }, [
    backendRole,
    busy,
    caption,
    clearDraft,
    clearProgressTimer,
    draftFile,
    draftKind,
    membershipRole,
    onPosted,
    startFakeUploadProgress,
    teamId,
    teamSeasonId,
    userId,
  ]);

  if (!canStaffManageTeamFeed(backendRole, membershipRole)) return null;

  const statusLabel =
    phase === 'uploading' ? 'Datei wird hochgeladen…' : phase === 'saving' ? 'Beitrag wird gespeichert…' : null;

  return (
    <section
      className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-red-500/35 p-[1px] shadow-2xl"
      style={{
        boxShadow:
          '0 0 0 1px rgba(220,38,38,0.12), 0 16px 40px rgba(0,0,0,0.55), 0 0 48px -12px rgba(220,38,38,0.25)',
      }}
      aria-label="Beitrag erstellen"
    >
      <div
        className={`rounded-[1.35rem] bg-gradient-to-b from-[#1a0a0a] via-[#0c0c0c] to-[#080404] px-4 sm:px-5 ${composerExpanded ? 'py-4' : 'py-2.5'}`}
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(220,38,38,0.2),transparent)] opacity-90 ${composerExpanded ? 'h-24' : 'h-14'}`}
        />

        <input
          ref={imgInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onImageChange}
        />
        <input
          ref={vidInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={onVideoChange}
        />

        {!composerExpanded ? (
          <button
            type="button"
            className="relative w-full touch-manipulation rounded-[1.25rem] py-0.5 pl-0.5 pr-1 text-left transition active:scale-[0.99]"
            onClick={() => setComposerExpanded(true)}
            aria-expanded={composerExpanded}
          >
            <div className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 shrink-0 text-red-400" strokeWidth={2} aria-hidden />
              <span className="text-base font-bold tracking-tight text-white">+ Beitrag erstellen</span>
            </div>
            <p className="mt-1 text-xs leading-snug text-white/50">Foto oder Video posten</p>
          </button>
        ) : (
        <div className="relative pr-10">
          <button
            type="button"
            disabled={busy}
            onClick={() => setComposerExpanded(false)}
            className="absolute right-0 top-0 z-10 flex min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-xl border border-white/12 bg-black/40 text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <div className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 shrink-0 text-red-400" strokeWidth={2} aria-hidden />
            <h2 className="text-base font-bold tracking-tight text-white">+ Beitrag erstellen</h2>
          </div>
          <p className="mt-1 text-xs leading-snug text-white/50">
            JPG/PNG/WebP bis 10 MB · MP4/MOV/WebM bis 150 MB · nur für Staff.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onPickImage}
              className="flex min-h-[48px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/25 bg-red-950/35 px-2 py-2.5 text-center text-xs font-semibold text-red-100 transition active:scale-[0.98] disabled:opacity-45"
            >
              <ImagePlus className="h-5 w-5 text-red-300" strokeWidth={2} aria-hidden />
              Foto posten
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onPickVideo}
              className="flex min-h-[48px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/25 bg-red-950/35 px-2 py-2.5 text-center text-xs font-semibold text-red-100 transition active:scale-[0.98] disabled:opacity-45"
            >
              <Video className="h-5 w-5 text-red-300" strokeWidth={2} aria-hidden />
              Video posten
            </button>
          </div>

          {draftFile ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white/90">{draftFile.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    {(draftFile.size / (1024 * 1024)).toFixed(1)} MB · {draftKind === 'image' ? 'Bild' : 'Video'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearDraft}
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/60 hover:bg-white/10"
                  aria-label="Auswahl aufheben"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
              Caption
            </span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={busy}
              maxLength={500}
              rows={3}
              placeholder="Was möchtest du teilen?"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/30 disabled:opacity-50"
            />
          </label>

          {busy && phase === 'uploading' ? (
            <div className="mt-3" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-[width] duration-150"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] text-white/50">{Math.min(99, uploadPct)} %</p>
            </div>
          ) : null}

          {statusLabel && phase === 'saving' ? (
            <p className="mt-2 text-center text-xs font-medium text-red-200/90">{statusLabel}</p>
          ) : null}

          <button
            type="button"
            disabled={busy || !draftFile || !userId}
            onClick={() => void publish()}
            className="mt-4 flex min-h-[50px] w-full touch-manipulation items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-600 to-red-900 px-4 text-sm font-bold text-white shadow-lg transition active:brightness-95 disabled:opacity-40"
          >
            <Send className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            Veröffentlichen
          </button>

          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]">
            <Link to="/app/termine" className="inline-flex items-center gap-1 text-white/50 hover:text-white/80">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Matchday Poster
            </Link>
            <Link to="/app/termine" className="inline-flex items-center gap-1 text-white/50 hover:text-white/80">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Ergebnis
            </Link>
          </div>

          {error ? (
            <p className="mt-3 text-center text-xs text-amber-300/95" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        )}
      </div>
    </section>
  );
};
