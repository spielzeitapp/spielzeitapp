import React from 'react';
import { DEFAULT_CLUB_BRANDING, type ClubBranding, readableTextColor } from '../lib/clubBranding';

export function ClubBrandingFields({ value, onChange, logoFile, onLogoFile }: {
  value: ClubBranding;
  onChange: (value: ClubBranding) => void;
  logoFile: File | null;
  onLogoFile: (file: File | null) => void;
}): React.ReactElement {
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!logoFile) { setPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  const logo = preview ?? value.logo_url;
  return <div className="mt-4 space-y-4">
    <h3 className="text-[14px] font-semibold text-slate-900">Vereinslogo und App-Farben</h3>
    <label className="block text-[13px] font-medium text-slate-700">Logo (PNG, JPEG oder WebP, maximal 5 MB)
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onLogoFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-[13px]" />
    </label>
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
        {logo ? <img src={logo} alt="Vereinslogo Vorschau" className="h-10 w-10 object-contain" /> : <span className="grid h-10 w-10 place-items-center rounded-full border border-current">★</span>}
        <strong>Vereinsansicht</strong>
      </div>
      <div className="flex items-center gap-3 p-3" style={{ backgroundColor: value.secondary_color ?? DEFAULT_CLUB_BRANDING.secondary_color }}>
        <span className="rounded-full px-4 py-2 text-[12px] font-bold" style={{ backgroundColor: value.accent_color ?? DEFAULT_CLUB_BRANDING.accent_color, color: readableTextColor(value.accent_color ?? DEFAULT_CLUB_BRANDING.accent_color!) }}>Aktiver Tab</span>
        <span className="text-[12px] text-slate-800">Termine · Kader · Feed</span>
      </div>
    </div>
  </div>;
}
