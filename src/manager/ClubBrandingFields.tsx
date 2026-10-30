import { ClubLogo } from "../components/branding/ClubLogo";
import React from 'react';
import { DEFAULT_CLUB_BRANDING, type ClubBranding, readableTextColor } from '../lib/clubBranding';

export function ClubBrandingFields({ value, onChange, logoFile, onLogoFile }: {
  value: ClubBranding;
  onChange: (value: ClubBranding) => void;
  logoFile: File | null;
  onLogoFile: (file: File | null) => void;
}): React.ReactElement {
  const [preview, setPreview] = React.useState<{ file: File; url: string } | null>(null);
  const [failedLogo, setFailedLogo] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!logoFile) { setPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setPreview({ file: logoFile, url });
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  const logo = logoFile ? (preview?.file === logoFile ? preview.url : null) : value.logo_url;
  return <div className="mt-4 space-y-4">
    <h3 className="text-[14px] font-semibold text-slate-900">Vereinslogo und App-Farben</h3>
    <label className="block text-[13px] font-medium text-slate-700">Logo (PNG, JPEG oder WebP, maximal 5 MB)
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onLogoFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-[13px]" />
    </label>
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
        {logo && failedLogo !== logo ? <ClubLogo key={logo} src={logo} alt={logoFile ? 'Neu ausgewähltes Vereinslogo' : 'Gespeichertes Vereinslogo'} className="h-full w-full object-contain" onError={() => setFailedLogo(logo)} /> : <span className="text-center text-xs text-slate-500">{logoFile && !logo ? 'Vorschau lädt…' : logo ? 'Bild nicht ladbar' : 'Kein Logo'}</span>}
      </div>
      <div className="min-w-0 flex-1" role="status">
        <p className={`text-sm font-semibold ${logoFile ? 'text-orange-800' : value.logo_url ? 'text-emerald-800' : 'text-slate-700'}`}>{logoFile ? 'Neues Logo · noch nicht gespeichert' : value.logo_url ? 'Logo gespeichert' : 'Noch kein Logo gespeichert'}</p>
        <p className="mt-1 break-words text-xs text-slate-600">{logoFile ? logoFile.name : value.logo_url ? 'Das gespeicherte Logo wird in der App verwendet. Wähle eine Datei, wenn du es ersetzen möchtest.' : 'Wähle eine Bilddatei und klicke anschließend auf Speichern.'}</p>
        {logo && failedLogo === logo && <p className="mt-1 text-xs text-red-700">Das Vorschaubild konnte nicht geladen werden.</p>}
      </div>
    </div>
    <p className="text-xs text-slate-500">Weiße Außenflächen werden automatisch freigestellt und leere Ränder zugeschnitten.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      {([['primary_color', 'Hauptfarbe'], ['secondary_color', 'Zweite Farbe'], ['accent_color', 'Akzentfarbe']] as const).map(([key, label]) =>
        <label key={key} className="text-[13px] font-medium text-slate-700">{label}
          <input type="color" value={value[key] ?? DEFAULT_CLUB_BRANDING[key]!} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 block h-11 w-full cursor-pointer rounded-lg" />
          <span className="font-mono text-[11px]">{value[key] ?? DEFAULT_CLUB_BRANDING[key]}</span>
        </label>)}
    </div>
    <button type="button" onClick={() => onChange({ ...DEFAULT_CLUB_BRANDING, logo_url: value.logo_url })} className="text-[12px] font-semibold underline">Schwarz–Rot–Weiß wiederherstellen</button>
    <div className="overflow-hidden rounded-xl border border-slate-200" aria-label="Vorschau der App-Farben">
      <div className="flex items-center gap-3 p-3" style={{ backgroundColor: value.primary_color ?? DEFAULT_CLUB_BRANDING.primary_color, color: readableTextColor(value.primary_color ?? DEFAULT_CLUB_BRANDING.primary_color!) }}>
        {logo ? <ClubLogo src={logo} alt="Vereinslogo Vorschau" className="h-10 w-10 object-contain" /> : <span className="grid h-10 w-10 place-items-center rounded-full border border-current">★</span>}
        <strong>Vereinsansicht</strong>
      </div>
      <div className="flex items-center gap-3 p-3" style={{ backgroundColor: value.secondary_color ?? DEFAULT_CLUB_BRANDING.secondary_color }}>
        <span className="rounded-full px-4 py-2 text-[12px] font-bold" style={{ backgroundColor: value.accent_color ?? DEFAULT_CLUB_BRANDING.accent_color, color: readableTextColor(value.accent_color ?? DEFAULT_CLUB_BRANDING.accent_color!) }}>Aktiver Tab</span>
        <span className="text-[12px] text-slate-800">Termine · Kader · Feed</span>
      </div>
    </div>
  </div>;
}
