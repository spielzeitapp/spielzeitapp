import {rotatePortraitCanvas} from '../lib/rotatePortraitCanvas';
import React,{useEffect,useRef,useState} from 'react';
import {playerPhotoDisplayUrl} from '../lib/playerPhotoDisplay';
import {erasePortraitStroke,restorePortraitStroke,matchingPortraitFrame,portraitPoint,type PortraitStroke} from '../lib/portraitRetouch';

export function PortraitCutoutRetouch({source,originalSource,rotation=0,onApply,onClose}:{source:string;originalSource?:string|null;rotation?:number;onApply:(blob:Blob)=>void;onClose:()=>void}) {
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),base=useRef<HTMLCanvasElement|null>(null);
 const original=useRef<HTMLCanvasElement|null>(null);
 const [mode,setMode]=useState<'erase'|'restore'>('erase'),[canRestore,setCanRestore]=useState(false),[restoreError,setRestoreError]=useState('');
 const strokes=useRef<PortraitStroke[]>([]),activeStroke=useRef<{id:number;stroke:PortraitStroke}|null>(null),alive=useRef(true);
 const [loading,setLoading]=useState(true),[exporting,setExporting]=useState(false),[error,setError]=useState('');
 const [size,setSize]=useState(1.5),[zoom,setZoom]=useState(1),[count,setCount]=useState(0);
 const paint=(ctx:CanvasRenderingContext2D,s:PortraitStroke,w:number,h:number)=>{if(s.mode==='restore'){if(original.current)restorePortraitStroke(ctx,s,w,h,original.current);}else erasePortraitStroke(ctx,s,w,h);};
 const repaint=()=>{const c=canvas.current,b=base.current;if(!c||!b)return;const ctx=c.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0);for(const s of strokes.current)paint(ctx,s,c.width,c.height);};
 useEffect(()=>{
  alive.current=true;setLoading(true);setError('');setRestoreError('');setCanRestore(false);setMode('erase');original.current=null;let live=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  const previous=document.activeElement as HTMLElement|null;root.current?.focus();
  void(async()=>{try{
   const response=await fetch(playerPhotoDisplayUrl(source),{signal:controller.signal});if(!response.ok)throw Error('Freisteller konnte nicht geladen werden.');
   const blob=await response.blob();if(blob.size>20*1024*1024)throw Error('Das Bild ist zu groß.');
   const bitmap=await createImageBitmap(blob);
   try{if(!live||!canvas.current)return;const c=canvas.current,b=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
    c.width=b.width=Math.max(1,Math.round(bitmap.width*scale));c.height=b.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=b.getContext('2d');if(!ctx)throw Error('Bildbearbeitung ist nicht verfügbar.');ctx.drawImage(bitmap,0,0,b.width,b.height);const upright=rotatePortraitCanvas(b,rotation);c.width=upright.width;c.height=upright.height;base.current=upright;strokes.current=[];setCount(0);repaint();
    if(originalSource){
     try{
      const response=await fetch(playerPhotoDisplayUrl(originalSource),{signal:controller.signal});if(!response.ok)throw Error('Originalfoto konnte nicht geladen werden.');
      const blob=await response.blob();if(blob.size>20*1024*1024)throw Error('Das Originalfoto ist zu groß.');
      const originalBitmap=await createImageBitmap(blob);
      try{
       if(!live)return;
       if(!matchingPortraitFrame(bitmap.width,bitmap.height,originalBitmap.width,originalBitmap.height))throw Error('Original und Freisteller haben unterschiedliche Bildausschnitte. Bitte den Freisteller aus diesem Original neu erstellen.');
       const aligned=document.createElement('canvas');aligned.width=b.width;aligned.height=b.height;
       const originalCtx=aligned.getContext('2d');if(!originalCtx)throw Error('Originalfoto konnte nicht geöffnet werden.');
       originalCtx.drawImage(originalBitmap,0,0,aligned.width,aligned.height);original.current=rotatePortraitCanvas(aligned,rotation);setCanRestore(true);
      }finally{originalBitmap.close();}
     }catch(e){if(live)setRestoreError(e instanceof Error?e.message:'Originalfoto nicht verfügbar.');}
    }
   }finally{bitmap.close();}
  }catch(e){if(live)setError(e instanceof Error?e.message:'Freisteller konnte nicht geöffnet werden.');}
  finally{clearTimeout(timeout);if(live)setLoading(false);}})();
  return()=>{live=false;alive.current=false;clearTimeout(timeout);controller.abort();base.current=null;original.current=null;previous?.focus?.();};
 },[source,originalSource,rotation]);
 const selectedToolStyle={borderColor:'rgb(var(--club-accent-rgb,37 99 235))',backgroundColor:'rgb(var(--club-accent-rgb,37 99 235) / .15)',color:'inherit'};
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>portraitPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect());
 const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  if(loading||exporting||error||e.button!==0||e.isPrimary===false)return;const p=point(e),ctx=e.currentTarget.getContext('2d');if(!p||!ctx)return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const stroke:PortraitStroke={size,points:[p],mode};activeStroke.current={id:e.pointerId,stroke};paint(ctx,stroke,e.currentTarget.width,e.currentTarget.height);
 };
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const active=activeStroke.current;if(!active||active.id!==e.pointerId)return;const p=point(e),ctx=e.currentTarget.getContext('2d');if(!p||!ctx)return;e.preventDefault();
  const previous=active.stroke.points.at(-1)!;active.stroke.points.push(p);paint(ctx,{size:active.stroke.size,mode:active.stroke.mode,points:[previous,p]},e.currentTarget.width,e.currentTarget.height);
 };
 const finish=(e:React.PointerEvent<HTMLCanvasElement>,cancel=false)=>{const active=activeStroke.current;if(!active||active.id!==e.pointerId)return;activeStroke.current=null;if(cancel)repaint();else{strokes.current.push(active.stroke);setCount(strokes.current.length);}};
 const apply=()=>{
  if(loading||exporting||!count||!canvas.current)return;setExporting(true);setError('');
  let output:HTMLCanvasElement;try{output=rotatePortraitCanvas(canvas.current,-rotation);}catch(e){setError(e instanceof Error?e.message:'Korrektur konnte nicht erstellt werden.');setExporting(false);return;}
  output.toBlob(blob=>{if(!alive.current)return;if(!blob){setError('Die Korrektur konnte nicht erstellt werden.');setExporting(false);return;}onApply(blob);},'image/png');
 };
 const keyDown=(e:React.KeyboardEvent)=>{
  if(e.key==='Escape'&&!exporting){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){
   const controls=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first.focus();}
  }
 };
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onPointerDown={e=>e.stopPropagation()}><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Freisteller-Kanten nachbessern" onKeyDown={keyDown} className="flex max-h-[94vh] w-full max-w-3xl flex-col gap-3 overflow-auto rounded-xl bg-white p-4 text-slate-900 shadow-xl">
  <h3 className="font-bold">Freisteller-Kanten nachbessern</h3>
  <p className="text-sm">Fehlt ein Ärmel oder ein Stück Trikot? „Aus Original wiederherstellen“ wählen und nur über die fehlende Stelle malen. „Radierer“ entfernt Hintergrundreste. Mit kleinen Pinselstrichen arbeiten, damit kein Fotohintergrund zurückkommt.</p>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Korrekturwerkzeug">
   <button type="button" aria-pressed={mode==='erase'} disabled={loading||exporting} onClick={()=>setMode('erase')} style={mode==='erase'?selectedToolStyle:undefined} className={`min-h-11 rounded-lg border px-3 py-2 ${mode==='erase'?'font-bold':''}`}>Radierer</button>
   <button type="button" aria-pressed={mode==='restore'} disabled={loading||exporting||!canRestore} onClick={()=>setMode('restore')} style={mode==='restore'?selectedToolStyle:undefined} className={`min-h-11 rounded-lg border px-3 py-2 disabled:opacity-40 ${mode==='restore'?'font-bold':''}`}>Aus Original wiederherstellen</button>
  </div>
  {!originalSource&&<p className="text-xs text-slate-600">Zum Wiederherstellen wird das Originalfoto des Spielers benötigt.</p>}
  {restoreError&&<p role="status" className="text-sm text-amber-800">{restoreError} Der Radierer bleibt verfügbar.</p>}
  <div className="flex flex-wrap gap-4"><label className="text-sm">{mode==='restore'?'Pinsel':'Radierer'}: {size}%<input aria-label="Pinselgröße" type="range" min="0.5" max="6" step="0.5" value={size} disabled={loading||exporting} onChange={e=>setSize(Number(e.target.value))}/></label><label className="text-sm">Ansicht: {zoom*100}%<input aria-label="Korrektur vergrößern" type="range" min="1" max="3" step="0.5" value={zoom} disabled={loading||exporting} onChange={e=>setZoom(Number(e.target.value))}/></label></div>
  {loading&&<p role="status">Freisteller wird geladen…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="min-h-0 overflow-auto rounded border bg-slate-500" style={{maxHeight:'58vh'}}><canvas ref={canvas} aria-label={mode==='restore'?'Fehlende Bildteile aus Original wiederherstellen':'Helle Ränder mit dem Radierer entfernen'} onPointerDown={start} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)} className="block max-w-none" style={{width:`${zoom*100}%`,height:'auto',touchAction:'none',cursor:'crosshair',background:'repeating-conic-gradient(#64748b 0% 25%,#cbd5e1 0% 50%) 0 0 / 20px 20px'}}/></div>
  <div className="flex flex-wrap gap-3"><button type="button" disabled={loading||exporting||!count} className="rounded border px-3 py-2 disabled:opacity-40" onClick={()=>{strokes.current.pop();setCount(strokes.current.length);repaint();}}>Rückgängig</button><button type="button" disabled={loading||exporting||!count} className="rounded border px-3 py-2 disabled:opacity-40" onClick={()=>{strokes.current=[];setCount(0);repaint();}}>Alle Korrekturen zurücksetzen</button><button type="button" disabled={loading||exporting||!count} className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-40" onClick={apply}>{exporting?'Übernehmen…':'Korrektur in Vorschau übernehmen'}</button><button type="button" disabled={exporting} className="rounded border px-3 py-2" onClick={onClose}>Abbrechen</button></div>
  <p className="text-xs text-slate-600">Erst der Speichern-Button im Fotoeditor speichert das Ergebnis dauerhaft. Beim Wiederherstellen werden echte Bildteile aus dem Originalfoto verwendet. Das Originalfoto bleibt erhalten.</p>
 </div></div>;
}
