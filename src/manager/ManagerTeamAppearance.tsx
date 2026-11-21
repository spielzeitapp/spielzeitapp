import React, { useEffect, useRef, useState } from 'react';
import { ClubLogo } from '../components/branding/ClubLogo';
import { DEFAULT_CLUB_BRANDING, getTeamBranding, normalizeBrandColor, readableTextColor, saveTeamBranding, type ClubBranding } from '../lib/clubBranding';
import { getClubLogo } from '../lib/teamLogos';

const NSG_BRANDING: ClubBranding = {
  logo_url: '/logos/nsg-goelsental.png',
  primary_color: '#7A1D2A',
  secondary_color: '#FFFFFF',
  accent_color: '#FF4050',
};

const COLORS = [
  ['primary_color', 'Hauptfarbe'],
  ['secondary_color', 'Zweite Farbe'],
  ['accent_color', 'Akzentfarbe'],
] as const;

const OPTIONS = [
  ['club', 'Vereinsdesign übernehmen'],
  ['nsg', 'NSG Gölsental'],
  ['custom', 'Eigenes Logo & Farben'],
] as const;

function designMode(branding: ClubBranding | null): typeof OPTIONS[number][0] {
  if (!branding) return 'club';
  const matchesNsg = branding.logo_url === NSG_BRANDING.logo_url
    && COLORS.every(([key]) => normalizeBrandColor(branding[key]) === NSG_BRANDING[key]);
  return matchesNsg ? 'nsg' : 'custom';
}

export function ManagerTeamAppearance({ clubId, clubName, teamId, teamLabel, clubDesign, onSaved }: {
  clubId: string;
  clubName: string;
  teamId: string;
  teamLabel: string;
  clubDesign: ClubBranding;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<typeof OPTIONS[number][0]>('club');
  const [custom, setCustom] = useState<ClubBranding>(DEFAULT_CLUB_BRANDING);
  const [file, setFile] = useState<File | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const loaded = loadState === 'ready';

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await getTeamBranding(teamId).catch(() => ({ data: null, error: true }));
      if (!active) return;
      if (result.error) {
        setError('Das Mannschaftsdesign konnte nicht geladen werden.');
        setLoadState('failed');
        return;
      }
      setMode(designMode(result.data));
      if (result.data) setCustom(result.data);
      setLoadState('ready');
    }
    void load();
    return () => { active = false; };
  }, [teamId]);

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !loaded) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const design = mode === 'nsg' ? NSG_BRANDING : mode === 'custom' ? custom : null;
      const result = await saveTeamBranding(clubId, teamId, design, mode === 'custom' ? file : null);
      if (result.error) { setError(result.error); return; }
      await onSaved();
      if (mode === 'custom' && result.data) setCustom(result.data);
      if (uploadInput.current) uploadInput.current.value = '';
      setFile(null);
      setSaved(true);
    } catch {
      setError('Der gespeicherte Stand konnte nicht geprüft werden. Bitte lade die Seite neu.');
    } finally {
      setBusy(false);
    }
  }

  const preview = mode === 'nsg' ? NSG_BRANDING : mode === 'custom' ? custom : clubDesign;
  const previewLogo = mode === 'custom' && filePreview ? filePreview : preview.logo_url || getClubLogo(clubName, { logoUrl: clubDesign.logo_url });
  const primary = normalizeBrandColor(preview.primary_color) || '#111114';
  const accent = normalizeBrandColor(preview.accent_color) || '#FF4050';

  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">Erscheinungsbild der Mannschaft</h3>
      <p className="mt-1 text-sm text-slate-600">Gilt für {teamLabel}, auch in weiteren Saisonen dieser Mannschaft.</p>
      {loadState === 'loading' && <p role="status" className="mt-3 text-sm text-slate-600">Mannschaftsdesign wird geladen …</p>}
      {loaded && <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <fieldset disabled={busy} className="space-y-2">
          <legend className="sr-only">Design auswählen</legend>
          {OPTIONS.map(([value, label]) => (
            <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2 font-medium ${mode === value ? 'border-red-700' : 'border-slate-300'}`}>
              <input type="radio" name={`team-design-${teamId}`} checked={mode === value} onChange={() => { setMode(value); setSaved(false); setError(null); }} className="accent-red-700" />
              {label}
            </label>
          ))}
          {mode === 'custom' && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" onChange={() => setSaved(false)}>
            <div className="grid gap-2 sm:grid-cols-3">
              {COLORS.map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-sm font-medium">
                  {label}
                  <input type="color" value={normalizeBrandColor(custom[key]) || DEFAULT_CLUB_BRANDING[key] || '#000000'} onChange={e => setCustom({ ...custom, [key]: e.target.value })} className="h-11 w-full cursor-pointer rounded border border-slate-300 bg-white p-1" />
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium">
              Mannschaftslogo
              <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
            </label>
            <p className="text-xs text-slate-600">PNG, JPEG oder WebP, bis 5 MB</p>
            {(custom.logo_url || file) && <button type="button" onClick={() => { setCustom({ ...custom, logo_url: null }); if (uploadInput.current) uploadInput.current.value = ''; setFile(null); setSaved(false); }} className="text-sm font-semibold text-red-700 hover:underline">Vereinslogo verwenden</button>}
          </div>}
        </fieldset>
        <div className="rounded-xl border-b-4 p-4" style={{ color: readableTextColor(primary), backgroundColor: primary, borderBottomColor: accent }}>
          <p className="text-sm font-semibold">Vorschau</p>
          <div className="mt-3 flex items-center gap-3">
            {mode === 'custom' && filePreview
              ? <img src={filePreview} alt="" className="h-14 w-14 shrink-0 object-contain" />
              : <ClubLogo src={previewLogo} alt="" className="h-14 w-14 shrink-0 object-contain" />}
            <p className="break-words font-bold">{teamLabel}</p>
          </div>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-3 text-sm font-medium text-green-800">Mannschaftsdesign gespeichert.</p>}
      {loaded && <button type="submit" disabled={busy} className="mt-4 min-h-11 rounded-full bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Speichert …' : 'Mannschaftsdesign speichern'}</button>}
    </form>
  );
}
