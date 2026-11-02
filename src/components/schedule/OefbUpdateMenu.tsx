import React,{useState} from 'react';
import {RefreshCw} from 'lucide-react';
/** Uses the existing, reviewed import workflow for the displayed season. */
export function OefbUpdateMenu({seasonId,allowed,className}:{seasonId:string|null|undefined;allowed:boolean;className?:string}){
 const [open,setOpen]=useState(false);
 if(!allowed||!seasonId)return null;
 const target='/manager/saisons/'+encodeURIComponent(seasonId);
 return <div className="relative">
  <button type="button" className={className} aria-expanded={open} aria-controls="oefb-update-actions" onClick={()=>setOpen(!open)}><RefreshCw className="h-4 w-4 shrink-0" aria-hidden/><span>ÖFB aktualisieren</span></button>
  {open?<section id="oefb-update-actions" aria-label="ÖFB aktualisieren" className="absolute right-0 top-full z-40 mt-2 w-[min(320px,85vw)] space-y-3 rounded-2xl border border-[rgb(var(--club-primary-rgb)/0.5)] bg-[#0b0d12] p-4 text-sm text-white shadow-xl">
   <h2 className="font-bold">ÖFB-Daten aktualisieren</h2>
   <p className="text-xs text-white/65">Für die ausgewählte Mannschaft und Saison. Vorschau prüfen und Übernahme bestätigen.</p>
   <a href={target+'/oefb-import'} className="sz-club-tab-active block rounded-xl border border-white/15 p-3 font-semibold">Termine &amp; Ergebnisse prüfen<span className="mt-1 block text-xs font-normal text-white/70">Neue Spiele und Endstände im Manager übernehmen.</span></a>
   <a href={target+'/kader'} className="block rounded-xl border border-white/15 p-3 font-semibold">Spielberichte &amp; Spielerstatistik prüfen<span className="mt-1 block text-xs font-normal text-white/70">ÖFB-Berichte prüfen, Spieler zuordnen und Tore nachtragen.</span></a>
   <p className="text-xs text-white/60">Gespeicherte Änderungen gelten für Spielplan, Spiele und Spielerprofile. Eigene Traineraufzeichnungen bleiben geschützt.</p>
   <button type="button" className="rounded-lg border border-white/20 px-3 py-2" onClick={()=>setOpen(false)}>Schließen</button>
  </section>:null}
 </div>;
}
