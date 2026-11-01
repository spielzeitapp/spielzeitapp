import React from 'react';
import type { ClubBranding } from '../lib/clubBranding';
export function ManagerAppPreviewPanel({clubId, teamSeasonId, branding, logoFile, onClose}: {
  clubId: string; teamSeasonId: string; branding: ClubBranding; logoFile: File | null; onClose: () => void;
}) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [logo, setLogo] = React.useState<string | null>(null);
  React.useEffect(() => {if (!logoFile) {setLogo(null);return;} const url=URL.createObjectURL(logoFile);setLogo(url);return ()=>URL.revokeObjectURL(url);},[logoFile]);
  const send = React.useCallback(() => frame.current?.contentWindow?.postMessage({type:'manager-preview-branding',branding:{...branding,logo_url:logo ?? branding.logo_url}},window.location.origin),[branding,logo]);
  React.useEffect(()=>{send();},[send]);
  React.useEffect(()=>{
    const receive=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===frame.current?.contentWindow&&event.data?.type==='manager-preview-ready')send();};
    window.addEventListener('message',receive);
    return ()=>{window.removeEventListener('message',receive);};
  },[send]);
  return <section role="region" aria-labelledby="app-preview-title" className="mx-auto mt-5 w-full max-w-[500px] overflow-hidden rounded-2xl border border-slate-300 bg-neutral-900 text-white">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 p-3">
      <div><h2 id="app-preview-title" className="font-bold">App-Vorschau</h2><p className="text-xs text-white/65">Logo und Farben aus dem Formular · gespeicherte Mannschaftsdaten · bedienbar · Änderungen werden nicht gespeichert</p></div>
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/30 px-4 font-bold">Ausblenden</button>
    </header>
    <div className="p-2 sm:p-4">
      <iframe ref={frame} title="App-Vorschau im Handyformat" src={`/app-preview?clubId=${encodeURIComponent(clubId)}&teamSeasonId=${encodeURIComponent(teamSeasonId)}`}
        sandbox="allow-scripts allow-same-origin" onLoad={send} className="mx-auto block h-[min(780px,80vh)] min-h-[480px] w-full max-w-[430px] rounded-2xl border border-white/20 bg-black" />
    </div>
  </section>;
}
