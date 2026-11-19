import React,{useState} from 'react';
import {ArrowLeft,Check,Plus,X} from 'lucide-react';
export type MarketTeamOption={id:string;name:string;age_group:string|null};
export function marketTeamAge(team:MarketTeamOption){const value=team.age_group||team.name;const match=value.match(/\bU\s*(\d{1,2})\b/i);return match?`U${Number(match[1])}`:value.trim()||'Weitere Mannschaften';}
export function MarketTeamWizard({teams,chosen,onChange,busy,children}:{teams:MarketTeamOption[];chosen:string[];onChange:(ids:string[])=>void;busy:boolean;children:React.ReactNode}){
 const [phase,setPhase]=useState<'age'|'team'|'more'|'review'>('age'),[age,setAge]=useState('');
 const selected=teams.filter(t=>chosen.includes(t.id)),remaining=teams.filter(t=>!chosen.includes(t.id));
 const ages=Array.from(new Set(remaining.map(marketTeamAge))).sort((a,b)=>a.localeCompare(b,'de',{numeric:true}));
 const options=remaining.filter(t=>marketTeamAge(t)===age);
 const add=(id:string)=>{if(!chosen.includes(id))onChange([...chosen,id]);setPhase('more');};
 const chooseAge=(value:string)=>{setAge(value);const matches=remaining.filter(t=>marketTeamAge(t)===value);if(matches.length===1)add(matches[0].id);else setPhase('team');};
 return <div className="market-team-wizard" aria-label="Geführte Mannschaftsauswahl">
  <ol className="market-join-steps" aria-label="Mannschaftsauswahl"><li data-current={phase==='age'||phase==='team'}>1 Mannschaft</li><li data-current={phase==='more'}>2 Weitere Kinder</li><li data-current={phase==='review'}>3 Prüfen & fertig</li></ol>
  <p className="market-team-wizard-note">Ein Elternkonto reicht für alle deine Kinder. Sind mehrere Kinder in derselben Mannschaft, genügt eine Auswahl. Kindernamen brauchst du hier nicht.</p>
  {phase==='age'?<>
   <h3>{chosen.length?'Welche weitere U-Mannschaft?':'In welcher U-Mannschaft spielt dein Kind?'}</h3>
   <p>Wähle zuerst die Altersgruppe. Gibt es mehrere Mannschaften, wählst du danach die passende aus.</p>
   <div className="market-team-wizard-choices">{ages.map(value=><button type="button" key={value} disabled={busy} onClick={()=>chooseAge(value)}>{value}</button>)}</div>
   {chosen.length>0&&<button type="button" className="market-text-button" disabled={busy} onClick={()=>setPhase('more')}><ArrowLeft size={16}/>Zur bisherigen Auswahl</button>}
  </>:phase==='team'?<>
   <button type="button" className="market-text-button" disabled={busy} onClick={()=>setPhase('age')}><ArrowLeft size={16}/>Andere U wählen</button>
   <h3>Welche Mannschaft in der {age}?</h3><p>Wähle die Mannschaft deines Kindes, zum Beispiel Hainfeld oder Rohrbach.</p>
   <div className="market-team-wizard-choices market-team-wizard-team-options">{options.map(team=><button type="button" key={team.id} disabled={busy} onClick={()=>add(team.id)}><strong>{team.name}</strong>{team.age_group&&<small>{team.age_group}</small>}</button>)}</div>
  </>:<>
   <h3>{phase==='more'?'Mannschaft hinzugefügt':'Deine Auswahl prüfen'}</h3>
   <ul className="market-team-wizard-summary" aria-label="Ausgewählte Mannschaften">{selected.map(team=><li key={team.id}><Check size={19}/><span><strong>{team.name}</strong><small>{team.age_group||marketTeamAge(team)}</small></span><button type="button" aria-label={`${team.name} entfernen`} disabled={busy} onClick={()=>{const next=chosen.filter(id=>id!==team.id);onChange(next);if(!next.length)setPhase('age');}}><X size={18}/></button></li>)}</ul>
   {phase==='more'?<>
    <h3>Spielt ein weiteres Kind in einer anderen Mannschaft?</h3>
    {remaining.length>0?<button type="button" className="public-market-cta" disabled={busy} onClick={()=>setPhase('age')}><Plus size={18}/>Ja, weitere Mannschaft</button>:<p>Alle verfügbaren Mannschaften sind bereits ausgewählt.</p>}
    <button type="button" className="public-market-cta market-team-wizard-secondary" disabled={busy} onClick={()=>setPhase('review')}>Nein, Auswahl prüfen</button>
   </>:<>
    {remaining.length>0&&<button type="button" className="market-text-button" disabled={busy} onClick={()=>setPhase('age')}><Plus size={16}/>Weitere Mannschaft hinzufügen</button>}
    <p role="status">{chosen.length} {chosen.length===1?'Mannschaft ausgewählt':'Mannschaften ausgewählt'}. Stimmt alles? Bestätige deine Vereinszugehörigkeit und schließe den Beitritt ab.</p>
    {children}
   </>}
  </>}
 </div>;
}
