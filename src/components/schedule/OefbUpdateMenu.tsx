import {Modal} from '../../app/ui/Modal';
import React,{useState} from 'react';
import {RefreshCw} from 'lucide-react';
/** Uses the existing, reviewed import workflow for the displayed season. */
export function OefbUpdateMenu({seasonId,allowed,className}:{seasonId:string|null|undefined;allowed:boolean;className?:string}){
 const [open,setOpen]=useState(false);
 if(!allowed||!seasonId)return null;
 const target='/manager/saisons/'+encodeURIComponent(seasonId);
 return <div className="relative min-w-0 flex-1">
  <button type="button" className={`${className ?? ''} w-full`} title="ÖFB-Daten verwalten" aria-label="ÖFB-Daten verwalten" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(!open)}><RefreshCw className="h-4 w-4 shrink-0" aria-hidden/><span>ÖFB</span></button>
  <Modal open={open} onClose={()=>setOpen(false)} title="ÖFB-Daten verwalten">
  <div id="oefb-update-actions" className="space-y-3 text-[16px] text-white">
   <p className="text-xs text-white/65">Für die ausgewählte Mannschaft und Saison. Vorschau prüfen und Übernahme bestätigen.</p>
   <a href={target+'/oefb-import'} className="sz-club-tab-active block rounded-xl border border-white/15 p-3 font-semibold">Termine &amp; Ergebnisse prüfen<span className="mt-1 block text-xs font-normal text-white/70">Neue Spiele und Endstände im Manager übernehmen.</span></a>
   <a href={target+'/kader'} className="block rounded-xl border border-white/15 p-3 font-semibold">Spielberichte &amp; Spielerstatistik prüfen<span className="mt-1 block text-xs font-normal text-white/70">ÖFB-Berichte prüfen, Spieler zuordnen und Tore nachtragen.</span></a>
   <p className="text-xs text-white/60">Gespeicherte Änderungen gelten für Spielplan, Spiele und Spielerprofile. Eigene Traineraufzeichnungen bleiben geschützt.</p>
   <button type="button" className="rounded-lg border border-white/20 px-3 py-2" onClick={()=>setOpen(false)}>Schließen</button>
  </div>
  </Modal>
 </div>;
}
