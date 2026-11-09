import React from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
type Props={clubName?:string;season?:string|null;actionLabel?:string;actionTo?:string;onAction?:()=>void;stats?:Array<{label:string;value:number;hint:string}>};
/** The original Sites hero; real data and actions are supplied by the Manager. */
export function ManagerComparisonWelcome({clubName,season,actionLabel,actionTo,onAction}:Props){
 const {pathname}=useLocation();
 if(!['/manager','/manager/dashboard','/manager/plattform'].includes(pathname))return null;
 return <section className="szc-hero" aria-label={clubName?'Deine Vereinszentrale':'Deine Plattformzentrale'}>
  <div><div className="szc-eyebrow">{season?'SAISON '+season:'SPIELZEITAPP'} <span>● {clubName?'VEREIN':'PLATTFORM'}</span></div><h2>{clubName?'Ein Team.':'Deine Vereine.'}<br/>Eine Zentrale.</h2><p>Von der ersten Trainingseinheit bis zum Abpfiff.<br/>Alles, was deinen Verein bewegt.</p>{onAction?<button type="button" onClick={onAction}>{actionLabel??'Verein einrichten'}<ArrowRight size={17}/></button>:<Link className="szc-hero-button" to={actionTo??'/manager/vereine'}>{actionLabel??'Verein auswählen'}<ArrowRight size={17}/></Link>}</div>
  <div className="szc-pitchArt" aria-hidden><div className="szc-pitchLines"><div className="szc-halfLine"/><div className="szc-centerCircle"/><div className="szc-penalty szc-top"/><div className="szc-penalty szc-bottom"/>{[[25,25],[70,24],[48,44],[25,64],[72,64],[48,83]].map(([x,y],i)=><div key={i} className={'szc-playerDot szc-p'+i} style={{left:x+'%',top:y+'%'}}>{i===5?'1':i===2?'10':i+4}</div>)}</div><span className="szc-artLabel">#GEMEINSAMSTARK</span></div>
 </section>;
}
