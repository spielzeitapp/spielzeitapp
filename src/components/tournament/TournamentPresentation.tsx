import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import QRCode from 'qrcode';
import {Monitor, Printer, QrCode, Share2, Maximize} from 'lucide-react';
import {publicTeamTournamentAbsoluteUrl, groupPublicTournamentMatches, type PublicTeamTournamentPageDto} from '../../lib/publicTeamTournament';
import {TournamentFanFixture, FanTeamLogo} from './TournamentFanFixture';
import './tournamentPresentation.css';

export function TournamentQr({publicId,onSettled}:{publicId:string;onSettled?:()=>void}) {
 const [src,setSrc]=useState(''),[error,setError]=useState(false);
 const url=publicTeamTournamentAbsoluteUrl(publicId);
 useEffect(()=>{let active=true;setSrc('');setError(false);void QRCode.toDataURL(url,{width:480,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}}).then(value=>{if(active){setSrc(value);onSettled?.()}}).catch(()=>{if(active){setError(true);onSettled?.()}});return()=>{active=false}},[url,onSettled]);
 return <div className="tournament-qr">{src?<img src={src} width={240} height={240} alt="QR-Code zur öffentlichen Turnierseite"/>:<p role="status">{error?'QR-Code nicht verfügbar – Link verwenden.':'QR-Code wird erstellt…'}</p>}<strong>Turnier live am Handy verfolgen</strong><p>Scannen · ohne App und Anmeldung</p><a href={url}>{url}</a></div>;
}
export function TournamentPresentationTools({page,onShare,canScreen=false}:{page:PublicTeamTournamentPageDto;onShare:()=>void;canScreen?:boolean}) {
 const [open,setOpen]=useState(false);
 return <section className="tournament-presentation-tools"><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open}><QrCode size={18}/>QR-Code</button>{canScreen?<Link to="?modus=screen"><Monitor size={18}/>Bildschirm</Link>:null}<Link to="?modus=print"><Printer size={18}/>Drucken / PDF</Link></div>{open?<div className="mt-4"><TournamentQr publicId={page.publicId}/><button type="button" onClick={onShare}><Share2 size={18}/>Link teilen</button></div>:null}</section>;
}
export function tournamentPresentationRows(page:PublicTeamTournamentPageDto) {
 const own=page.ownParticipantName||page.teamName;
 const matches=page.allMatches;
 if(!page.schedule?.length)return matches.map(m=>({id:m.id,time:m.kickoffTimeLabel,homeTeam:m.homeName||(m.ourIsHome===false?m.opponentName:own),awayTeam:m.awayName||(m.ourIsHome===false?own:m.opponentName),homeGoals:m.ourIsHome===false?m.scoreOpp:m.scoreOur,awayGoals:m.ourIsHome===false?m.scoreOur:m.scoreOpp,groupLabel:m.groupLabel}));
 return page.schedule.map(row=>{const local=matches.find(m=>m.kickoffTimeLabel===row.time&&((row.homeTeam===own&&row.awayTeam===m.opponentName)||(row.awayTeam===own&&row.homeTeam===m.opponentName)));if(!local||local.status==='upcoming'||local.status==='canceled')return row;return {...row,homeGoals:row.homeTeam===own?local.scoreOur:local.scoreOpp,awayGoals:row.homeTeam===own?local.scoreOpp:local.scoreOur};});
}
export function TournamentPrintDocument({page,paper,printedAt,onQrSettled}:{page:PublicTeamTournamentPageDto;paper:string;printedAt:string;onQrSettled:()=>void}) {
 const rows=tournamentPresentationRows(page);
 const perPage=paper==='A3'?9:6;
 const fixturePages=Array.from({length:Math.max(1,Math.ceil(rows.length/perPage))},(_,i)=>rows.slice(i*perPage,(i+1)*perPage));
 const tablePages=(page.groupTables??[]).flatMap(group=>Array.from({length:Math.max(1,Math.ceil(group.rows.length/8))},(_,i)=>({...group,rows:group.rows.slice(i*8,(i+1)*8),continuation:i>0})));
 const total=fixturePages.length+tablePages.length;
 const logo=(name:string)=><FanTeamLogo name={name} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl}/>;
 const sheet=(content:React.ReactNode,index:number,title:string)=><section className="tournament-print-sheet" key={index} aria-label={`${title} · Seite ${index+1} von ${total}`}>
   <header className="tournament-print-header"><div className="tournament-print-brand">{logo(page.ownParticipantName||page.teamName)}<div><p>SPIELZEITAPP · TURNIER</p><h1>{page.tournamentName}</h1><p>{[page.dateLabel,page.venue].filter(Boolean).join(' · ')}</p></div></div><TournamentQr publicId={page.publicId} onSettled={onQrSettled}/></header>
   <h2>{title}</h2>{content}
   <footer><span>Stand: {printedAt} · Aktuelle Ergebnisse über den QR-Code</span><strong>Seite {index+1} / {total}</strong></footer>
 </section>;
 return <div className="tournament-print-document" data-paper={paper}>
 {fixturePages.map((fixtures,i)=>sheet(<div className="tournament-print-fixtures">{fixtures.length?fixtures.map(r=><article key={r.id} className="tournament-print-fixture"><p className="tournament-print-fixture-meta">{r.time} Uhr{r.groupLabel?` · Gruppe ${r.groupLabel}`:''}</p><div className="tournament-print-pairing"><div>{logo(r.homeTeam)}<strong>{r.homeTeam}</strong></div><div className="tournament-print-score"><span>{r.homeGoals==null?'Anpfiff':'Stand'}</span><strong>{r.homeGoals==null?r.time:`${r.homeGoals}:${r.awayGoals??'–'}`}</strong></div><div>{logo(r.awayTeam)}<strong>{r.awayTeam}</strong></div></div></article>):<p>Spielplan folgt.</p>}</div>,i,`Spielplan und Ergebnisse${i?' · Fortsetzung':''}`))}
 {tablePages.map((g,i)=>sheet(<div className="tournament-print-standings"><h3>Gruppe {g.groupLabel}{g.continuation?' · Fortsetzung':''}{page.standingsProvisional?' · vorläufig':''}</h3><table><thead><tr><th>#</th><th>Mannschaft</th><th>Sp.</th><th>Tore</th><th>Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName}><td>{r.rank}</td><th><span>{logo(r.teamName)}{r.teamName}</span></th><td>{r.played}</td><td>{r.goalsFor}:{r.goalsAgainst}</td><td><strong>{r.points}</strong></td></tr>)}</tbody></table></div>,fixturePages.length+i,'Gruppentabellen'))}
 </div>;
}
export function TournamentPresentation({page,mode,error}:{page:PublicTeamTournamentPageDto;mode:'screen'|'print';error?:string|null}) {
 const [qrReady,setQrReady]=useState(false);
 const qrSettled=React.useCallback(()=>setQrReady(true),[]);
 const [paper,setPaper]=useState('A4'),[fullscreenError,setFullscreenError]=useState('');
 const [panel,setPanel]=useState(0);
 useEffect(()=>{if(mode!=='screen'||!page.groupTables?.length)return;const id=window.setInterval(()=>setPanel(n=>(n+1)%(1+(page.groupTables?.length||0))),12000);return()=>window.clearInterval(id)},[mode,page.groupTables?.length]);
 const [printedAt,setPrintedAt]=useState(()=>new Date().toLocaleString('de-AT'));
 const grouped=groupPublicTournamentMatches(page.allMatches),featured=grouped.live[0]??grouped.upcoming[0]??grouped.results[0];
 const tables=<>{page.groupTables?.filter((_,index)=>mode!=='screen'||index===panel-1).map(g=><section key={g.groupLabel}><h2>Gruppe {g.groupLabel}{page.standingsProvisional?' · vorläufig':''}</h2><table><thead><tr><th>#</th><th>Mannschaft</th><th>Sp.</th><th>Tore</th><th>Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName}><td>{r.rank}</td><th>{r.teamName}</th><td>{r.played}</td><td>{r.goalsFor}:{r.goalsAgainst}</td><td><strong>{r.points}</strong></td></tr>)}</tbody></table></section>)}</>;
 return <div className={`tournament-presentation tournament-presentation--${mode}`} style={{'--presentation-accent':page.accentColor||'#c82333'} as React.CSSProperties}>
 {mode==='print'?<style>{`@page {size: ${paper} landscape; margin: 12mm;}`}</style>:null}
 <div className="presentation-controls"><Link to="?">← Turnierseite</Link>{mode==='screen'?<button type="button" onClick={()=>{if(!document.documentElement.requestFullscreen){setFullscreenError('Vollbild bitte über das Browsermenü öffnen.');return;}void document.documentElement.requestFullscreen().catch(()=>setFullscreenError('Vollbild bitte über das Browsermenü öffnen.'));}}><Maximize size={18}/>Vollbild</button>:<><label>Papier <select value={paper} onChange={e=>setPaper(e.target.value)}><option>A4</option><option>A3</option></select></label><button type="button" disabled={!qrReady} onClick={()=>{setPrintedAt(new Date().toLocaleString('de-AT'));window.requestAnimationFrame(()=>window.print());}}><Printer size={18}/>Drucken / als PDF speichern</button></>}{fullscreenError?<p role="status">{fullscreenError}</p>:null}</div>
 {mode==='screen'?<header><div><p>SpielzeitApp · {page.dateLabel}</p><h1>{page.tournamentName}</h1><p>{page.venue}</p></div></header>:<p className="tournament-print-hint">Vorschau: Spielkarten mit Wappen · {paper==='A3'?'9':'6'} Spiele pro Blatt · Tabellen auf eigenen Seiten</p>}
 {error?<p role="status" className="presentation-warning">Verbindung unterbrochen – letzter geladener Stand.</p>:null}
 {mode==='screen'?<div className="presentation-screen-grid"><main>{panel===0?<>{featured?<div className="presentation-hero"><TournamentFanFixture home={page.ownParticipantName||featured.ourTeamName} away={featured.opponentName} status={featured.status} homeGoals={featured.scoreOur} awayGoals={featured.scoreOpp} time={featured.kickoffTimeLabel} phase={featured.groupLabel?`Gruppe ${featured.groupLabel}`:'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} prominent clock={page.matchDetails?.find(m=>m.id===featured.id)} scorers={page.scorers?.filter(s=>s.time===featured.kickoffTimeLabel)}/></div>:<h2>Spielplan folgt</h2>}<h2>Als Nächstes · unser Team</h2>{grouped.upcoming.filter(m=>m.id!==featured?.id).slice(0,3).map(m=><p className="presentation-next" key={m.id}><strong>{m.kickoffTimeLabel}</strong> {m.ourTeamName} – {m.opponentName}</p>)}</> : tables}</main><aside><TournamentQr publicId={page.publicId}/><p>Anzeige aktualisiert sich automatisch. Spiel und Tabellen wechseln alle 12 Sekunden.</p><p>{page.syncedAt?`Veranstalterstand: ${new Date(page.syncedAt).toLocaleTimeString('de-AT')}`:''}</p></aside></div>:<TournamentPrintDocument page={page} paper={paper} printedAt={printedAt} onQrSettled={qrSettled}/> }
 </div>;
}
