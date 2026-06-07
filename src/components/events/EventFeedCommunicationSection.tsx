import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, Trash2 } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import type { EventFeedSettingsRow } from '../../types/eventFeedSettings';
import {
  clearEventPoster,
  loadEventFeedSettings,
  uploadEventPoster,
  upsertEventFeedSettings,
} from '../../lib/eventFeedSettings';
import {
  isEventPosterManualFeedPublished,
  publishEventPosterToFeed,
} from '../../lib/publishEventPosterFeedPost';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { Button } from '../../app/components/ui/Button';
import { Card } from '../../app/components/ui/Card';

type Props = {
  event: EventRow;
  userId: string | null;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/30';

export const EventFeedCommunicationSection: React.FC<Props> = ({ event, userId }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settings, setSettings] = useState<EventFeedSettingsRow | null>(null);
  const [captionOverride, setCaptionOverride] = useState('');
  const [preferCustomPoster, setPreferCustomPoster] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualPublished, setManualPublished] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const posterPath = settings?.poster_storage_path ?? settings?.poster_url ?? null;
  const previewSrc = useFeedMediaSrc(posterPath);

  const reload = useCallback(async () => {
    if (!event.id) return;
    setLoading(true);
    setError(null);
    const [row, published] = await Promise.all([
      loadEventFeedSettings(event.id),
      isEventPosterManualFeedPublished(event.id),
    ]);
    setSettings(row);
    setCaptionOverride(row?.caption_override ?? '');
    setPreferCustomPoster(row?.prefer_custom_poster !== false);
    setManualPublished(published);
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    if (expanded) void reload();
  }, [expanded, reload]);

  const onPickPoster = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const onPosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !event.team_season_id) return;
    setUploading(true);
    setError(null);
    setStatusMessage(null);
    const { storagePath, error: upErr } = await uploadEventPoster({
      eventId: event.id,
      teamSeasonId: event.team_season_id,
      file,
      userId,
      previousStoragePath: posterPath,
    });
    setUploading(false);
    if (upErr || !storagePath) {
      setError(upErr ?? 'Upload fehlgeschlagen.');
      return;
    }
    setStatusMessage('Poster gespeichert.');
    await reload();
  };

  const onSaveTextSettings = async () => {
    if (!event.team_season_id) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    const { error: saveErr } = await upsertEventFeedSettings({
      event_id: event.id,
      team_season_id: event.team_season_id,
      caption_override: captionOverride.trim() || null,
      prefer_custom_poster: preferCustomPoster,
      post_mode: 'manual_only',
      created_by: userId,
    });
    setSaving(false);
    if (saveErr) {
      setError(saveErr);
      return;
    }
    setStatusMessage('Einstellungen gespeichert.');
    await reload();
  };

  const onDeletePoster = async () => {
    if (!event.team_season_id || !posterPath) return;
    if (!window.confirm('Poster wirklich entfernen?')) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    const { error: delErr } = await clearEventPoster({
      eventId: event.id,
      teamSeasonId: event.team_season_id,
      storagePath: posterPath,
    });
    setSaving(false);
    if (delErr) {
      setError(delErr);
      return;
    }
    setStatusMessage('Poster entfernt.');
    await reload();
  };

  const onPublish = async () => {
    if (!settings || !posterPath) return;
    setPublishing(true);
    setError(null);
    setStatusMessage(null);
    const result = await publishEventPosterToFeed({ event, settings, userId });
    setPublishing(false);
    if (!result.ok) {
      if (result.reason === 'already_posted') {
        setManualPublished(true);
        setError('Dieses Poster wurde bereits im Feed veröffentlicht.');
      } else if (result.reason === 'no_poster') {
        setError('Bitte zuerst ein Poster hochladen.');
      } else {
        setError(typeof result.reason === 'string' ? result.reason : 'Veröffentlichen fehlgeschlagen.');
      }
      return;
    }
    setManualPublished(true);
    setStatusMessage('Poster wurde im Feed veröffentlicht.');
  };

  return (
    <Card className="mt-6 flex flex-col gap-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] active:bg-white/[0.05]"
      >
        <span className="text-[17px] font-semibold text-white">Feed &amp; Kommunikation</span>
        <span className="shrink-0 text-[14px] text-white/60" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[13px] leading-snug text-white/70">
            Automatische Veröffentlichung folgt im nächsten Schritt. Du kannst das Poster bereits manuell im Feed
            veröffentlichen.
          </p>

          {loading ? <p className="text-[14px] text-white/70">Lade Einstellungen…</p> : null}

          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-white/55">Poster</p>
            {previewSrc ? (
              <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                <img
                  src={previewSrc}
                  alt="Poster-Vorschau"
                  className="max-h-[min(42dvh,16rem)] w-full object-contain"
                />
              </div>
            ) : (
              <p className="mb-3 text-[13px] text-white/50">Noch kein Poster hochgeladen.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="soft"
                size="sm"
                disabled={uploading || saving}
                onClick={onPickPoster}
                className="inline-flex items-center gap-1.5"
              >
                <ImagePlus className="h-4 w-4" aria-hidden />
                {posterPath ? 'Poster ersetzen' : 'Poster hochladen'}
              </Button>
              {posterPath ? (
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  disabled={uploading || saving}
                  onClick={() => void onDeletePoster()}
                  className="inline-flex items-center gap-1.5 text-red-200"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Poster löschen
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(ev) => void onPosterFile(ev)}
            />
            {uploading ? <p className="mt-2 text-[12px] text-white/60">Poster wird hochgeladen…</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-white/55">
              Eigener Feed-Text
            </label>
            <textarea
              value={captionOverride}
              onChange={(ev) => setCaptionOverride(ev.target.value)}
              rows={3}
              placeholder="Optional — leer = Titel, Datum/Uhrzeit, Ort"
              className={`${inputClass} min-h-[4.5rem] resize-y`}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-[14px] text-white/90">
            <input
              type="checkbox"
              checked={preferCustomPoster}
              onChange={(ev) => setPreferCustomPoster(ev.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border border-white/25 bg-black/30"
            />
            <span>Eigenes Poster bevorzugen</span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="primary" size="sm" disabled={saving || uploading} onClick={() => void onSaveTextSettings()}>
              {saving ? 'Speichern…' : 'Einstellungen speichern'}
            </Button>
            <Button
              variant="soft"
              size="sm"
              disabled={!posterPath || publishing || manualPublished}
              onClick={() => void onPublish()}
              className="inline-flex items-center gap-1.5"
            >
              <Send className="h-4 w-4" aria-hidden />
              {publishing ? 'Veröffentliche…' : 'Jetzt im Feed posten'}
            </Button>
          </div>

          {manualPublished ? (
            <p className="text-[13px] text-amber-200/90">Dieses Poster wurde bereits im Feed veröffentlicht.</p>
          ) : null}
          {statusMessage ? <p className="text-[13px] text-emerald-300/95">{statusMessage}</p> : null}
          {error ? <p className="text-[13px] text-red-300/95">{error}</p> : null}
        </div>
      ) : null}
    </Card>
  );
};
