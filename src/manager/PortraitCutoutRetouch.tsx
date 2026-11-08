import React,{useEffect,useRef,useState} from 'react';
import {rotatePortraitCanvas} from '../lib/rotatePortraitCanvas';
import {playerPhotoDisplayUrl} from '../lib/playerPhotoDisplay';
import {erasePortraitStroke,restorePortraitStroke,outlinePortrait,validPortraitOutline,matchingPortraitFrame,portraitPoint,type PortraitStroke,type PortraitPoint} from '../lib/portraitRetouch';

type Tool='erase'|'restore'|'outline'|'pan';
type Props={source:string;originalSource?:string|null;sourceIsOriginal?:boolean;initialMode?:Tool;rotation?:number;onApply:(blob:Blob)=>void;onClose:()=>void;onRestartFromOriginal?:()=>void};

export function PortraitCutoutRetouch({source,originalSource,sourceIsOriginal=false,initialMode='erase',rotation=0,onApply,onClose,onRestartFromOriginal}:Props) {
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),guide=useRef<HTMLCanvasElement>(null);
 const base=useRef<HTMLCanvasElement|null>(null),original=useRef<HTMLCanvasElement|null>(null);
 const strokes=useRef<PortraitStroke[]>([]),future=useRef<PortraitStroke[]>([]),activeStroke=useRef<{id:number;stroke:PortraitStroke}|null>(null),alive=useRef(true);
 const [mode,setMode]=useState<Tool>('erase'),[canRestore,setCanRestore]=useState(false),[restoreError,setRestoreError]=useState('');
 const [loading,setLoading]=useState(true),[exporting,setExporting]=useState(false),[loadError,setLoadError]=useState(''),[error,setError]=useState('');
 const [size,setSize]=useState(1.5),[zoom,setZoom]=useState(1),[count,setCount]=useState(0),[redoCount,setRedoCount]=useState(0);
 const [points,setPoints]=useState<PortraitPoint[]>([]),[cursor,setCursor]=useState<PortraitPoint|null>(null);
 const [showOriginal,setShowOriginal]=useState(false),[backdrop,setBackdrop]=useState('grid'),[dimensions,setDimensions]=useState({width:1,height:1});
 const paint=(ctx:CanvasRenderingContext2D,s:PortraitStroke,w:number,h:number)=>{
  if(s.mode==='restore'){if(original.current)restorePortraitStroke(ctx,s,w,h,original.current);}
  else if(s.mode==='outline'){if(original.current)outlinePortrait(ctx,s.points,w,h,original.current);}
  else erasePortraitStroke(ctx,s,w,h);
 };
 const repaint=()=>{const c=canvas.current,b=base.current;if(!c||!b)return;const ctx=c.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0);for(const s of strokes.current)paint(ctx,s,c.width,c.height);};
 const record=(stroke:PortraitStroke)=>{strokes.current.push(stroke);future.current=[];setCount(strokes.current.length);setRedoCount(0);};
 useEffect(()=>{
  alive.current=true;let live=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  setLoading(true);setError('');setLoadError('');setRestoreError('');setCanRestore(false);setMode('erase');setPoints([]);setCursor(null);setShowOriginal(false);
  original.current=null;activeStroke.current=null;strokes.current=[];future.current=[];setCount(0);setRedoCount(0);
  const previous=document.activeElement as HTMLElement|null;root.current?.focus();
  const load=async(url:string)=>{const response=await fetch(playerPhotoDisplayUrl(url),{signal:controller.signal});if(!response.ok)throw Error('Foto konnte nicht geladen werden.');const blob=await response.blob();if(blob.size>20*1024*1024)throw Error('Das Bild ist zu groß.');return createImageBitmap(blob);};
  void(async()=>{try{
   const bitmap=await load(source);
   try{
    if(!live||!canvas.current)return;
    const c=canvas.current,b=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
    b.width=Math.max(1,Math.round(bitmap.width*scale));b.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=b.getContext('2d');if(!ctx)throw Error('Bildbearbeitung ist nicht verfügbar.');ctx.drawImage(bitmap,0,0,b.width,b.height);
    const upright=rotatePortraitCanvas(b,rotation);c.width=upright.width;c.height=upright.height;base.current=upright;setDimensions({width:c.width,height:c.height});repaint();
    if(sourceIsOriginal||originalSource===source){original.current=upright;}
    else if(originalSource){
     try{
      const originalBitmap=await load(originalSource);
      try{
       if(!live)return;
       if(!matchingPortraitFrame(bitmap.width,bitmap.height,originalBitmap.width,originalBitmap.height))throw Error('Original und Freisteller haben unterschiedliche Bildausschnitte. Mit „Manuell aus Original freistellen“ kannst du direkt hier eine neue Freistellung erstellen.');
       const aligned=document.createElement('canvas');aligned.width=b.width;aligned.height=b.height;
       const originalCtx=aligned.getContext('2d');if(!originalCtx)throw Error('Originalfoto konnte nicht geöffnet werden.');
       originalCtx.drawImage(originalBitmap,0,0,aligned.width,aligned.height);original.current=rotatePortraitCanvas(aligned,rotation);
      }finally{originalBitmap.close();}
     }catch(e){if(live)setRestoreError(e instanceof Error?e.message:'Originalfoto nicht verfügbar.');}
    }
    if(original.current&&live){
     setCanRestore(true);setMode(initialMode);setShowOriginal(initialMode==='restore');
     if(guide.current){guide.current.width=original.current.width;guide.current.height=original.current.height;guide.current.getContext('2d')?.drawImage(original.current,0,0);}
    }
   }finally{bitmap.close();}
  }catch(e){if(live)setLoadError(e instanceof Error?e.message:'Foto konnte nicht geöffnet werden.');}
  finally{clearTimeout(timeout);if(live)setLoading(false);}})();
  return()=>{live=false;alive.current=false;clearTimeout(timeout);controller.abort();base.current=null;original.current=null;previous?.focus?.();};
 },[source,originalSource,sourceIsOriginal,initialMode,rotation]);
 const selectedToolStyle={borderColor:'rgb(var(--club-accent-rgb,37 99 235))',backgroundColor:'rgb(var(--club-accent-rgb,37 99 235) / .15)',color:'inherit'};
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>portraitPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect());
 const finishOutline=()=>{
  if(loading||exporting||!original.current||!canvas.current)return;
  if(!validPortraitOutline(points)){setError('Bitte mindestens drei Punkte um die Person setzen. Die Punkte dürfen nicht auf einer Linie liegen.');return;}
  const stroke:PortraitStroke={mode:'outline',size:0,points:[...points]};record(stroke);repaint();setPoints([]);setMode('restore');setShowOriginal(false);setError('');
 };
 const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  if(loading||exporting||loadError||mode==='pan'||e.button!==0||e.isPrimary===false)return;
  const p=point(e),ctx=e.currentTarget.getContext('2d');if(!p||!ctx)return;e.preventDefault();setError('');
  if(mode==='outline'){setPoints(old=>[...old,p]);return;}
  e.currentTarget.setPointerCapture(e.pointerId);const stroke:PortraitStroke={size,points:[p],mode};activeStroke.current={id:e.pointerId,stroke};paint(ctx,stroke,e.currentTarget.width,e.currentTarget.height);
 };
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const p=point(e);if(p)setCursor(p);const active=activeStroke.current;if(!active||active.id!==e.pointerId||!p)return;
  const ctx=e.currentTarget.getContext('2d');if(!ctx)return;e.preventDefault();const previous=active.stroke.points.at(-1)!;active.stroke.points.push(p);
  paint(ctx,{size:active.stroke.size,mode:active.stroke.mode,points:[previous,p]},e.currentTarget.width,e.currentTarget.height);
 };
 const finish=(e:React.PointerEvent<HTMLCanvasElement>,cancel=false)=>{const active=activeStroke.current;if(!active||active.id!==e.pointerId)return;activeStroke.current=null;if(cancel)repaint();else record(active.stroke);};
 const undo=()=>{setError('');if(points.length){setPoints(old=>old.slice(0,-1));return;}const last=strokes.current.pop();if(last)future.current.push(last);setCount(strokes.current.length);setRedoCount(future.current.length);repaint();};
 const redo=()=>{const next=future.current.pop();if(next)strokes.current.push(next);setCount(strokes.current.length);setRedoCount(future.current.length);repaint();};
 const apply=()=>{
  if(loading||exporting||!count||points.length||!canvas.current)return;setExporting(true);setError('');
  let output:HTMLCanvasElement;try{output=rotatePortraitCanvas(canvas.current,-rotation);}catch(e){setError(e instanceof Error?e.message:'Korrektur konnte nicht erstellt werden.');setExporting(false);return;}
  // Only the editable canvas is exported. Original guide, cursor and outline SVG are view-only.
  output.toBlob(blob=>{if(!alive.current)return;if(!blob){setError('Die Korrektur konnte nicht erstellt werden.');setExporting(false);return;}onApply(blob);},'image/png');
 };
 const keyDown=(e:React.KeyboardEvent)=>{
  if(e.key==='Escape'&&!exporting){e.preventDefault();e.stopPropagation();if(points.length)setPoints([]);else onClose();}
  if(e.key==='Tab'){
   const controls=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)');if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first.focus();}
  }
 };
 const tool=(value:Tool,label:string,needsOriginal=false)=><button key={value} type="button" aria-pressed={mode===value} disabled={loading||exporting||(needsOriginal&&!canRestore)||Boolean(points.length&&value!=='outline'&&value!=='pan')} onClick={()=>{setMode(value);setCursor(null);}} style={mode===value?selectedToolStyle:undefined} className={`min-h-11 rounded-lg border px-3 py-2 disabled:opacity-40 ${mode===value?'font-bold':''}`}>{label}</button>;
 const background=backdrop==='dark'?'#151519':backdrop==='light'?'#f5f5f5':'repeating-conic-gradient(#64748b 0% 25%,#cbd5e1 0% 50%) 0 0 / 20px 20px';
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onPointerDown={e=>e.stopPropagation()}><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Freisteller-Kanten nachbessern" onKeyDown={keyDown} className="flex max-h-[94vh] w-full max-w-4xl flex-col gap-3 overflow-auto rounded-xl bg-white p-4 text-slate-900 shadow-xl">
  <h3 className="font-bold">Freisteller bearbeiten · direkt in der App</h3>
  <p className="text-sm">Fehlende Ärmel mit „Aus Original wiederherstellen“ zurückmalen. „Person umranden“ erstellt eine manuelle Freistellung. „Radierer“ entfernt Hintergrundreste. Das Originalfoto bleibt erhalten.</p>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Korrekturwerkzeug">{tool('restore','Aus Original wiederherstellen',true)}{tool('erase','Radierer')}{tool('outline','Person umranden',true)}{tool('pan','Ansicht verschieben')}</div>
  {!originalSource&&!sourceIsOriginal&&<p className="text-xs text-slate-600">Zum Wiederherstellen wird das Originalfoto des Spielers benötigt.</p>}
  {restoreError&&<p role="status" className="text-sm text-amber-800">{restoreError} Der Radierer bleibt verfügbar.</p>}
  {restoreError&&onRestartFromOriginal&&<button type="button" disabled={loading||exporting} onClick={onRestartFromOriginal} className="min-h-11 rounded-lg border px-3 py-2 font-semibold">Manuell aus Original freistellen</button>}
  {mode==='outline'?<div className="rounded-lg border p-3 text-sm"><p>Am Rand entlang Punkte um die gesamte Person setzen – Ärmel, Haare und Hände einschließen. Erst „Person freistellen“ schließt den Umriss. {points.length} Punkte gesetzt.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={loading||exporting||points.length<3} onClick={finishOutline} className="min-h-11 rounded-lg border px-3 font-semibold">Person freistellen</button><button type="button" disabled={!points.length} onClick={()=>{setPoints([]);setError('');}} className="min-h-11 rounded-lg border px-3">Umriss verwerfen</button></div></div>:mode==='pan'?<p className="text-sm">Mit Finger oder Trackpad verschieben. Danach zum Pinsel oder Umriss wechseln.</p>:<p className="text-sm">{mode==='restore'?'Originalvorlage einblenden und nur über die fehlende Stelle malen. Kleine Pinselstriche verhindern, dass Fotohintergrund zurückkommt.':'Nur über den unerwünschten Hintergrund malen. Rückgängig stellt entfernte Bildteile wieder her.'}</p>}
  <div className="flex flex-wrap items-center gap-4"><label className="text-sm">Pinsel: {size}%<input aria-label="Pinselgröße" type="range" min="0.5" max="12" step="0.5" value={size} disabled={loading||exporting||mode==='outline'||mode==='pan'} onChange={e=>setSize(Number(e.target.value))}/></label><label className="text-sm">Ansicht: {zoom*100}%<input aria-label="Korrektur vergrößern" type="range" min="1" max="4" step="0.5" value={zoom} disabled={loading||exporting} onChange={e=>setZoom(Number(e.target.value))}/></label><label className="text-sm">Prüfhintergrund<select aria-label="Prüfhintergrund" value={backdrop} onChange={e=>setBackdrop(e.target.value)} className="ml-2 rounded border p-2"><option value="grid">Schachbrett</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></div>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Original als Vorlage einblenden" checked={showOriginal} disabled={!canRestore||loading||exporting} onChange={e=>setShowOriginal(e.target.checked)}/>Original als Vorlage einblenden · nur Orientierung, wird nicht gespeichert</label>
  {loading&&<p role="status">Foto wird geladen…</p>}{(loadError||error)&&<p role="alert" className="text-red-700">{loadError||error}</p>}
  <div className="min-h-0 shrink-0 overflow-auto rounded border" style={{maxHeight:'52vh',minHeight:'180px',background}}><div className="relative" style={{width:`min(${zoom*100}%, ${52*dimensions.width/dimensions.height*zoom}vh)`,margin:zoom===1?'0 auto':undefined}}>
   <canvas ref={guide} aria-hidden="true" data-portrait-guide="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{opacity:showOriginal ? 0.35 : 0}}/>
   <canvas ref={canvas} data-portrait-editor-canvas="true" aria-label={mode==='restore'?'Fehlende Bildteile aus Original wiederherstellen':mode==='outline'?'Punkte um die Person setzen':'Helle Ränder mit dem Radierer entfernen'} onPointerDown={start} onPointerMove={move} onPointerLeave={()=>setCursor(null)} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)} className="relative block h-auto w-full max-w-none" style={{touchAction:mode==='pan'?'auto':'none',cursor:mode==='pan'?'grab':'crosshair'}}/>
   <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
    {points.length>0&&<><polyline points={points.map(p=>`${p.x*dimensions.width},${p.y*dimensions.height}`).join(' ')} fill="none" stroke="#00d4ff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>{points.map((p,i)=><circle key={i} cx={p.x*dimensions.width} cy={p.y*dimensions.height} r={dimensions.width*.005} fill={i===0?'#7cff8d':'#fff'} stroke="#111" vectorEffect="non-scaling-stroke"/>)}</>}
    {cursor&&(mode==='erase'||mode==='restore')&&<circle cx={cursor.x*dimensions.width} cy={cursor.y*dimensions.height} r={dimensions.width*size/200} fill="none" stroke={mode==='restore'?'#00e8b0':'#ff7676'} strokeWidth="2" vectorEffect="non-scaling-stroke"/>}
   </svg>
  </div></div>
  <div className="flex flex-wrap gap-3"><button type="button" disabled={loading||exporting||(!count&&!points.length)} className="min-h-11 rounded border px-3 py-2 disabled:opacity-40" onClick={undo}>Rückgängig</button><button type="button" disabled={loading||exporting||!redoCount||Boolean(points.length)} className="min-h-11 rounded border px-3 py-2 disabled:opacity-40" onClick={redo}>Wiederholen</button><button type="button" disabled={loading||exporting||(!count&&!points.length)} className="min-h-11 rounded border px-3 py-2 disabled:opacity-40" onClick={()=>{strokes.current=[];future.current=[];setCount(0);setRedoCount(0);setPoints([]);repaint();}}>Alle Korrekturen zurücksetzen</button><button type="button" disabled={loading||exporting||!count||Boolean(points.length)} className="min-h-11 rounded bg-red-700 px-3 py-2 text-white disabled:opacity-40" onClick={apply}>{exporting?'Übernehmen…':'Korrektur in Vorschau übernehmen'}</button><button type="button" disabled={exporting} className="min-h-11 rounded border px-3 py-2" onClick={onClose}>Abbrechen</button></div>
  <p className="text-xs text-slate-600">Erst der Speichern-Button im Fotoeditor speichert das Ergebnis dauerhaft. Die Originalvorlage und Hilfslinien werden nicht exportiert.</p>
 </div></div>;
}
