import React from 'react';
import {ManagerPhonePreview} from './ManagerPhonePreview';
import {Link} from 'react-router-dom';
import {Eye,Check,ChevronRight,ArrowUpRight,Shield} from 'lucide-react';
import {useReferenceData,referenceSteps} from './ManagerReferenceData';

export function ManagerReferenceRail(){
 const {seasonId,clubId,snapshot,photo,loading,canReviewClub,error}=useReferenceData();
 const steps=referenceSteps(snapshot,photo,clubId,seasonId,canReviewClub);
 const done=steps.filter(s=>s.state==='done'||s.state==='skipped').length;
 return <aside className="szc-rightColumn" aria-label="App-Vorschau und Einrichtung">
  <article className="szc-panel szc-previewPanel">
   <div className="szc-sectionHeading"><h2><Eye size={16}/>App-Vorschau</h2><span className="szc-tinyLabel">TEST</span></div>
   <div className="szc-segmented" aria-label="Vorschaumodus"><span className="active">Manager / TEST</span>{canReviewClub?<Link to="/manager/live-veroeffentlichung">LIVE-Status</Link>:<span>LIVE separat</span>}</div>
   {seasonId&&clubId?<ManagerPhonePreview key={clubId+seasonId} clubId={clubId} seasonId={seasonId}/>:<div className="szc-phone szc-preview-idle"><Eye size={28}/><h3>Mannschaft auswählen</h3><p>Wähle zuerst Verein, Mannschaft und Saison.</p></div>}
   <p className="szc-previewNote">Echte TEST-Daten · Vorschau speichert keine Änderungen.</p>
  </article>
  <article className="szc-panel szc-compactChecklist">
   <div className="szc-sectionHeading"><h2>Schritt für Schritt</h2><small>{snapshot?`${done}/${steps.length}`:'Einrichtung'}</small></div>
   {snapshot&&<div className="szc-progress"><i style={{width:`${done/steps.length*100}%`}}/></div>}
   {loading&&<p className="szc-previewNote" role="status">Status wird geladen…</p>}
   {error&&<p className="szc-previewNote" role="status">Status nicht prüfbar. Bereiche bleiben erreichbar.</p>}
   {steps.map((s,i)=><Link key={s.key} to={s.to} title={s.detail}><span className={'szc-smallCheck '+(['done','skipped'].includes(s.state)?'done':'')} data-state={s.state}>{['done','skipped'].includes(s.state)?<Check size={12}/>:i+1}</span><span><strong>{s.title}</strong><small>{s.detail}</small></span><ChevronRight size={13}/></Link>)}
   <Link className="szc-link" to={canReviewClub&&clubId&&seasonId?`/manager/vereine/${clubId}?setupSeason=${seasonId}#manager-setup-checklist`:'/manager/saisons'}>Einrichtung öffnen <ArrowUpRight size={14}/></Link>
  </article>
  <div className="szc-helpCard"><Shield size={19}/><b>Eine Datenquelle. Dein Verein.</b><p>Bestehende Managerfunktionen.<br/>Dieselben Mannschaften und TEST-Daten.</p><small>SpielzeitApp · Vereinszentrale</small></div>
 </aside>;
}
