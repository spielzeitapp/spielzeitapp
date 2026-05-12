import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Clapperboard, ImagePlus, Trophy, Video } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const STAFF_ROLES = new Set(['admin', 'head_coach', 'trainer', 'co_trainer']);

function isStaffBackendRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return STAFF_ROLES.has(role.trim().toLowerCase());
}

type Props = {
  backendRole: string;
  teamSeasonId: string;
  teamId: string;
  onPosted: () => void;
};

export const HomeFeedComposer: React.FC<Props> = ({ backendRole, teamSeasonId, teamId, onPosted }) => {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const uploadAndInsert = useCallback(
    async (file: File, mediaType: 'image' | 'video') => {
      setError(null);
      setBusy(true);
      setPhase('uploading');
      const ext =
        (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || (mediaType === 'video' ? 'mp4' : 'jpg');
      const folder = mediaType === 'video' ? 'videos' : 'images';
      const objectPath = `${folder}/${teamSeasonId}/${crypto.randomUUID()}.${ext}`;

      try {
        const { error: upErr } = await supabase.storage.from('team-feed').upload(objectPath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);

        const { data: pub } = supabase.storage.from('team-feed').getPublicUrl(objectPath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) throw new Error('Keine öffentliche URL für die Datei.');

        setPhase('saving');
        const caption =
          mediaType === 'video' ? '🎬 Neues Video vom Team' : '📷 Neues Foto vom Team';
        const dedupeKey = `manual:${crypto.randomUUID()}`;
        const { error: insErr } = await supabase.from('team_feed_posts').insert({
          team_season_id: teamSeasonId,
          team_id: teamId,
          event_id: null,
          post_kind: mediaType === 'video' ? 'trainer_video' : 'trainer_image',
          caption,
          payload: {},
          dedupe_key: dedupeKey,
          media_type: mediaType,
          media_url: publicUrl,
          thumbnail_url: null,
          duration_seconds: null,
        });
        if (insErr) throw new Error(insErr.message);
        onPosted();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setPhase('idle');
      }
    },
    [onPosted, teamId, teamSeasonId],
  );

  const onPickImage = useCallback(() => {
    imgInputRef.current?.click();
  }, []);

  const onPickVideo = useCallback(() => {
    vidInputRef.current?.click();
  }, []);

  const onImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f || busy) return;
      if (!f.type.startsWith('image/')) {
        setError('Bitte eine Bilddatei wählen.');
        return;
      }
      void uploadAndInsert(f, 'image');
    },
    [busy, uploadAndInsert],
  );

  const onVideoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f || busy) return;
      if (!f.type.startsWith('video/')) {
        setError('Bitte eine Videodatei (z. B. MP4) wählen.');
        return;
      }
      void uploadAndInsert(f, 'video');
    },
    [busy, uploadAndInsert],
  );

  if (!isStaffBackendRole(backendRole)) return null;

  const statusLabel =
    phase === 'uploading' ? 'Upload läuft…' : phase === 'saving' ? 'Beitrag wird gespeichert…' : null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-red-500/35 p-[1px] shadow-2xl"
      style={{
        boxShadow:
          '0 0 0 1px rgba(220,38,38,0.12), 0 16px 40px rgba(0,0,0,0.55), 0 0 48px -12px rgba(220,38,38,0.25)',
      }}
      aria-label="Beitrag erstellen"
    >
      <div
        className="rounded-[1.35rem] bg-gradient-to-b from-[#1a0a0a] via-[#0c0c0c] to-[#080404] px-3 py-4 sm:px-4"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(220,38,38,0.2),transparent)] opacity-90" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 shrink-0 text-red-400" strokeWidth={2} aria-hidden />
            <h2 className="text-base font-bold tracking-tight text-white">Beitrag erstellen</h2>
          </div>
          <p className="mt-1 text-xs leading-snug text-white/50">
            Für Eltern, Fans und Spieler sichtbar im Team-Feed.
          </p>

          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
          <input
            ref={vidInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
            onChange={onVideoChange}
          />

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onPickImage}
              className="flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-red-500/25 bg-red-950/35 px-2 py-3 text-center text-xs font-semibold text-red-100 shadow-inner transition active:scale-[0.98] disabled:opacity-45"
            >
              <ImagePlus className="h-6 w-6 text-red-300" strokeWidth={2} aria-hidden />
              Foto posten
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onPickVideo}
              className="flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-red-500/25 bg-red-950/35 px-2 py-3 text-center text-xs font-semibold text-red-100 shadow-inner transition active:scale-[0.98] disabled:opacity-45"
            >
              <Video className="h-6 w-6 text-red-300" strokeWidth={2} aria-hidden />
              Video posten
            </button>
            <Link
              to="/app/termine"
              className="flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-3 text-center text-xs font-semibold text-white/90 transition hover:bg-white/[0.1] active:scale-[0.98]"
            >
              <Camera className="h-6 w-6 text-white/70" strokeWidth={2} aria-hidden />
              Matchday Poster
            </Link>
            <Link
              to="/app/termine"
              className="flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-3 text-center text-xs font-semibold text-white/90 transition hover:bg-white/[0.1] active:scale-[0.98]"
            >
              <Trophy className="h-6 w-6 text-white/70" strokeWidth={2} aria-hidden />
              Ergebnis posten
            </Link>
          </div>

          {statusLabel ? (
            <p className="mt-3 text-center text-xs font-medium text-red-200/90">{statusLabel}</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-center text-xs text-amber-300/95" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};
