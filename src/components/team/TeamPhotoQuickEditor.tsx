import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, RotateCcw, Save } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { getTeamSeasonWritableState } from '../../lib/seasonTransition';
import { uploadStorageObject } from '../../lib/storageUpload';
import { DEFAULT_TEAM_PHOTO_LAYOUT, normalizeTeamPhotoLayout, teamPhotoImageStyle, type TeamPhotoLayout } from '../../lib/teamPhotoLayout';

export type EditableTeamPhoto = Partial<TeamPhotoLayout> & {
  team_season_id: string;
  photo_url: string;
  updated_at?: string | null;
};
const PHOTO_COLUMNS = 'team_season_id,photo_url,updated_at,photo_zoom,photo_position_x,photo_position_y,photo_brightness';
const KEYS = Object.keys(DEFAULT_TEAM_PHOTO_LAYOUT) as (keyof TeamPhotoLayout)[];

/** A single mobile workflow: choose, adjust, save and return to the team. */
export function TeamPhotoQuickEditor({ seasonId, photo, onSaved, onClose }: {
  seasonId: string;
  photo: EditableTeamPhoto | null;
  onSaved: (photo: EditableTeamPhoto) => void;
  onClose: () => void;
}) {
  const initial = normalizeTeamPhotoLayout(photo);
  const [layout, setLayout] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; horizontal: number; vertical: number } | null>(null);
  const src = preview || photo?.photo_url || null;
  const dirty = Boolean(file) || KEYS.some(key => layout[key] !== initial[key]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { setImageFailed(false); setImageReady(false); }, [src]);

  function close() {
    if (saving.current) return;
    if (dirty && !window.confirm('Ungespeicherte Fotoänderungen verwerfen?')) return;
    onClose();
  }
  function pick(next: File | undefined) {
    if (!next || saving.current) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Bitte JPG, PNG oder WebP auswählen.'); return; }
    if (next.size > 4 * 1024 * 1024) { setError('Das Foto darf maximal 4 MB groß sein.'); return; }
    setError(''); setFile(next); setLayout({ ...DEFAULT_TEAM_PHOTO_LAYOUT });
  }
  async function save() {
    if (saving.current || !src || !imageReady || imageFailed) return;
    if (!dirty) { onClose(); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      const writable = await getTeamSeasonWritableState(seasonId);
      if ('error' in writable || !writable.writable) throw Error('error' in writable ? writable.error : writable.message);
      let url = photo?.photo_url || '';
      if (file) {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${seasonId}/hero-${crypto.randomUUID()}.${extension}`;
        const result = await uploadStorageObject('team-photos', path, file, { upsert: false, contentType: file.type });
        if (result.error) throw result.error;
        url = supabase.storage.from('team-photos').getPublicUrl(path).data.publicUrl;
        if (!url) throw Error('Keine Foto-Adresse erhalten. Bitte erneut versuchen.');
      }
      const values = { photo_url: url, ...layout, updated_at: new Date().toISOString() };
      let query;
      if (photo) {
        query = supabase.from('team_photos').update(values).eq('team_season_id', seasonId).eq('photo_url', photo.photo_url);
        // Keep concurrent manager edits and photo replacements intact.
        if (photo.updated_at != null) query = query.eq('updated_at', photo.updated_at);
        for (const key of KEYS) query = photo[key] == null ? query.is(key, null) : query.eq(key, photo[key]);
      } else {
        query = supabase.from('team_photos').insert({ team_season_id: seasonId, ...values });
      }
      const { data, error: saveError } = await query.select(PHOTO_COLUMNS).maybeSingle();
      if (saveError) throw saveError;
      if (!data) throw Error('Das Foto wurde inzwischen geändert. Bitte schließen und neu öffnen.');
      onSaved(data as EditableTeamPhoto);
      window.dispatchEvent(new Event('manager-setup-changed'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (failure as { message?: string })?.message || 'Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally { saving.current = false; setBusy(false); }
  }
  function slider(key: keyof TeamPhotoLayout, label: string, min: number, max: number) {
    return <label className="block text-sm font-semibold" key={key}>
      <span className="flex justify-between gap-3">{label}<span className="font-normal text-white/60">{layout[key]} %</span></span>
      <input type="range" aria-label={label} min={min} max={max} value={layout[key]} onChange={event => setLayout(old => ({ ...old, [key]: Number(event.target.value) }))} className="block h-10 w-full accent-[rgb(var(--club-accent-rgb))]" />
    </label>;
  }
  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40';
  return <Modal isOpen title="Mannschaftsfoto anpassen" onClose={close} footer={<>
    <button type="button" disabled={busy} className={actionClass} onClick={close}><ArrowLeft className="h-4 w-4" aria-hidden />Zurück</button>
    <button type="button" disabled={busy || !src || !imageReady || imageFailed} onClick={() => void save()} className={`${actionClass} bg-[rgb(var(--club-primary-rgb))] text-white`}><Save className="h-4 w-4" aria-hidden />{busy ? 'Speichern…' : 'Speichern & zurück'}</button>
  </>}>
    <div className="space-y-3 text-white" data-manager-artwork>
      <p className="text-sm text-white/65">Bild mit dem Finger verschieben oder die Regler verwenden.</p>
      <div className="relative mx-auto h-[220px] w-full max-w-[390px] overflow-hidden rounded-2xl bg-black" style={{ touchAction: src ? 'none' : 'auto' }}
        onPointerDown={event => {
          if (!src || !imageReady || imageFailed || busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: layout.photo_position_x, vertical: layout.photo_position_y };
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId || busy) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
          setLayout(old => ({ ...old, photo_position_x: clamp(start.horizontal - (event.clientX - start.x) / bounds.width * 100), photo_position_y: clamp(start.vertical - (event.clientY - start.y) / bounds.height * 100) }));
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        {src ? <img key={src} src={src} alt="Vorschau Mannschaftsfoto" draggable={false} onLoad={() => { setImageReady(true); setImageFailed(false); }} onError={() => { setImageFailed(true); setImageReady(false); }} style={teamPhotoImageStyle(layout)} className="absolute inset-0 h-full w-full select-none object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Noch kein Mannschaftsfoto</span>}
      </div>
      {imageFailed ? <p role="alert" className="text-sm text-red-300">Foto konnte nicht geladen werden. Bitte ein anderes Foto auswählen.</p> : null}
      <fieldset disabled={busy || !src || !imageReady || imageFailed} className="grid grid-cols-2 gap-x-4 gap-y-1">
        {slider('photo_zoom', 'Zoom', 100, 220)}{slider('photo_brightness', 'Helligkeit', 50, 150)}
        {slider('photo_position_x', 'Links / rechts', 0, 100)}{slider('photo_position_y', 'Oben / unten', 0, 100)}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className={actionClass}><Camera className="h-4 w-4" aria-hidden />{src ? 'Foto ersetzen' : 'Foto auswählen'}</button>
        <button type="button" disabled={busy || !src} onClick={() => setLayout({ ...DEFAULT_TEAM_PHOTO_LAYOUT })} className={actionClass}><RotateCcw className="h-4 w-4" aria-hidden />Zurücksetzen</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Neues Mannschaftsfoto auswählen" onChange={event => { pick(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </div>
  </Modal>;
}
