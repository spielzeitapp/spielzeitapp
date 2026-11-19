import React,{useEffect,useState} from 'react';import{HeartHandshake}from'lucide-react';import{Link}from'react-router-dom';import{supabase}from'../../lib/supabaseClient';import{fundMoney,type FundTeam}from'./teamFund';import './teamFund.css';
export type FundRow={team_id:string;value:string};
export function TeamFundFields({clubId,rows,onChange}:{clubId:string;rows:FundRow[];onChange:(rows:FundRow[])=>void}){
 const[teams,setTeams]=useState<FundTeam[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{let active=true;void supabase.rpc('exchange_fund_options',{p_club_id:clubId}).then(r=>{if(!active)return;if(r.error)setError('Deine Teams konnten nicht geladen werden. Bitte Inserat erneut öffnen.');else setTeams(r.data||[]);setLoading(false);});return()=>{active=false;};},[clubId]);
 return <section className="team-fund-card"><h3><HeartHandshake size={21}/>Für deine Teamkassa</h3><p>Der Käufer bezahlt dich bei der Übergabe. Danach meldest du den Verkauf hier und gibst den Betrag an den Verein für deine ausgewählten Teams weiter. Erst nach bestätigtem Geldeingang zählt er zur Teamkassa.</p>{loading?<p role="status">Deine Teams werden geladen …</p>:error?<p role="alert">{error}</p>:!teams.length?<p>Dir ist noch kein freigegebenes Team zugeordnet. Ergänze deine Teamauswahl im <Link to={`/vereinsmarkt/${clubId}?view=profil`}>Profil</Link> oder wende dich an die Vereinsverwaltung.</p>:<>{rows.map((r,i)=><div className="fund-split-row" key={i}><label>Team<select required value={r.team_id} onChange={e=>onChange(rows.map((x,j)=>i===j?{...x,team_id:e.target.value}:x))}><option value="">Team auswählen</option>{teams.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}{r.team_id&&!teams.some(t=>t.id===r.team_id)&&<option value={r.team_id}>Bisheriges Team – bitte Zuordnung prüfen</option>}</select></label><label>Betrag in Euro<input required inputMode="decimal" value={r.value} placeholder="5,00" onChange={e=>onChange(rows.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/></label><button type="button" aria-label={`Team ${i+1} entfernen`} onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>Entfernen</button></div>)}{rows.length<teams.length&&<button type="button" onClick={()=>onChange([...rows,{team_id:teams.length===1?teams[0].id:'',value:''}])}>+ Team hinzufügen</button>}<small>Beispiel: 10 € Gesamtbetrag → U12: 5 € und U13: 5 €. Nach deiner Verkaufsmeldung bleiben Betrag und Aufteilung fest.</small></>}</section>;
}
type Detail={payment_note:string|null;split:{label:string;amount_cents:number}[];pledge:{id:string;status:string;reference:string;mine:boolean;initiated_by:'buyer'|'seller'}|null;taken:boolean};
export function TeamFundDetail({listingId,revision,owner,onChanged}:{listingId:string;revision:number;owner:boolean;onChanged?:()=>Promise<void>|void}){
 const[data,setData]=useState<Detail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selling,setSelling]=useState(false),[agreed,setAgreed]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;setData(null);setError('');setSelling(false);setAgreed(false);void supabase.rpc('exchange_fund_detail',{p_listing_id:listingId}).then(r=>{if(!active)return;if(r.error)setError('Teambeitrag konnte nicht geladen werden.');else setData(r.data);});return()=>{active=false;};},[listingId,revision]);
 async function action(cancel=false){
  if(busy||(!cancel&&!agreed))return;setBusy(true);setError('');setNotice('');
  try{
   const r=cancel?await supabase.rpc('exchange_fund_cancel',{p_id:data?.pledge?.id}):await supabase.rpc('exchange_fund_pledge',{p_listing_id:listingId,p_expected:revision});
   if(r.error)throw r.error;
   const fresh=await supabase.rpc('exchange_fund_detail',{p_listing_id:listingId});if(fresh.error)throw fresh.error;setData(fresh.data);
   setSelling(false);setAgreed(false);setNotice(cancel?'Meldung storniert. Das Inserat bleibt vergeben. Bei Bedarf kannst du es über den Status wieder freigeben.':'Verkauf gemeldet. Dein Teambeitrag ist jetzt in der Teamkassa als offen sichtbar. Bitte gib das Geld noch weiter.');
   await onChanged?.();
  }catch(e){setError(e&&typeof e==='object'&&'message'in e?String(e.message):'Bitte erneut versuchen.');}finally{setBusy(false);}
 }
 return <section className="team-fund-card"><h3><HeartHandshake size={22}/>Fürs Team</h3>
 {data?<>
  <ul>{data.split.map((s,i)=><li key={i}>{s.label}<strong>{fundMoney(s.amount_cents)}</strong></li>)}</ul>
  {data.pledge?<>
   <span className="fund-state">{data.pledge.status==='confirmed'?'Geld erhalten · Teamkassa gebucht':data.pledge.initiated_by==='seller'?'Verkauft · Teambeitrag noch offen':'Frühere Käufer-Vormerkung · noch offen'}</span>
   {(owner||data.pledge.mine)&&<>
    <p>Verwendungszweck: <strong>{data.pledge.reference}</strong></p>
    {data.pledge.status==='pending'&&<>
     <p>{data.pledge.initiated_by==='seller'?'Du hast den Kaufpreis erhalten. Gib den vorgemerkten Betrag jetzt an den Verein für deine Teams weiter. Trainer oder Kassier bestätigen anschließend den tatsächlichen Geldeingang.':'Diese Vormerkung stammt aus dem bisherigen Ablauf: Der Käufer zahlt direkt an den Verein. Nicht zusätzlich als Verkäufer einzahlen.'}</p>
     {data.pledge.mine&&<>
      {data.payment_note?<p className="fund-payment-note">{data.payment_note}</p>:<p>Vereinbare die Geldübergabe mit deinem Trainer oder Kassier. Der Verein hat noch keine Zahlungsinformationen hinterlegt.</p>}
      <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Offene Meldung wirklich stornieren? Es wird keine Buchung oder Geldbewegung ausgelöst.'))void action(true);}}>Offene Meldung stornieren</button>
     </>}
    </>}
   </>}
  </>:owner?<>
   <p>Vereinbare Kauf und Übergabe im Chat. Der Käufer bezahlt dich. Nach dem Verkauf meldest du hier den erhaltenen Betrag für deine Teams.</p>
   {!selling?<button type="button" className="exchange-primary exchange-full sz-club-primary" disabled={busy||data.taken} onClick={()=>setSelling(true)}>Verkauft – Teamspende vormerken</button>:<div className="fund-sale-confirm">
    <h4>Verkauf abschließen</h4><p>Das Inserat wird als vergeben markiert. Die oben angezeigte Aufteilung erscheint als offener Beitrag in der Teamkassa. Das Guthaben erhöht sich erst, wenn Trainer oder Kassier den Eingang bestätigen.</p>
    <label className="exchange-check"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>Ich habe den Artikel übergeben und den Kaufpreis erhalten. Ich gebe diesen Betrag an den Verein für die ausgewählten Teams weiter.</label>
    <button type="button" className="exchange-primary exchange-full sz-club-primary" disabled={!agreed||busy} onClick={()=>void action()}>{busy?'Wird gemeldet …':'Verkauf bestätigen & Beitrag vormerken'}</button>
    <button type="button" disabled={busy} onClick={()=>{setSelling(false);setAgreed(false);}}>Abbrechen</button>
   </div>}
  </>:<p>Interesse? Schreibe dem Anbieter und vereinbart die Übergabe. Du bezahlst den Anbieter. Er gibt den vereinbarten Betrag an die oben ausgewählten Teams weiter. Hier erfolgt keine Online-Zahlung.</p>}
 </>:!error&&<p role="status">Teambeitrag wird geladen …</p>}
 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
