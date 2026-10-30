import React from 'react';
import { createPortal } from 'react-dom';
import type { ClubBranding } from '../lib/clubBranding';
import { lockAppMainScroll } from '../lib/bodyScrollLock';
export function ManagerAppPreviewDialog({clubId, teamSeasonId, branding, logoFile, onClose}: {
  clubId: string; teamSeasonId: string; branding: ClubBranding; logoFile: File | null; onClose: () => void;
}) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [logo, setLogo] = React.useState<string | null>(null);
  React.useEffect(() => {if (!logoFile) {setLogo(null);return;} const url=URL.createObjectURL(logoFile);setLogo(url);return ()=>URL.revokeObjectURL(url);},[logoFile]);
  const send = React.useCallback(() => frame.current?.contentWindow?.postMessage({type:'manager-preview-branding',branding:{...branding,logo_url:logo ?? branding.logo_url}},window.location.origin),[branding,logo]);
  React.useEffect(()=>{send();},[send]);
  React.useEffect(()=>{
    const receive=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===frame.current?.contentWindow&&event.data?.type==='manager-preview-ready')send();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    const unlock=lockAppMainScroll();window.addEventListener('message',receive);window.addEventListener('keydown',key);
    return ()=>{unlock();window.removeEventListener('message',receive);window.removeEventListener('keydown',key);};
  },[send,onClose]);
  return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="app-preview-title" className="fixed inset-0 z-[9999] flex flex-col bg-neutral-900 text-white">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 p-3">
      <div><h2 id="app-preview-title" className="font-bold">App-Vorschau</h2><p className="text-xs text-white/65">Logo und Farben aus dem Formular · gespeicherte Mannschaftsdaten · keine Änderungen in der App</p></div>
      <button autoFocus type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/30 px-4 font-bold">Schließen</button>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
      <iframe ref={frame} title="App-Vorschau im Handyformat" src={`/app-preview?clubId=${encodeURIComponent(clubId)}&teamSeasonId=${encodeURIComponent(teamSeasonId)}`}
        sandbox="allow-scripts allow-same-origin" onLoad={send} className="mx-auto block h-full min-h-[480px] w-full max-w-[430px] rounded-2xl border border-white/20 bg-black" />
    </div>
  </div>,document.body);
}
