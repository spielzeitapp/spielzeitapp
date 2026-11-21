import {MarketTeamWizard} from './MarketTeamWizard';
import {requestMarketHomeGuide} from './MarketHomeScreenGuide';
import React, {useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabaseClient';
import {useAuth} from '../../auth/AuthProvider';
import {marketAuthPath} from './marketAuth';
import './marketJoin.css';

export function marketInviteToken(value: string | null): string {
 return /^[0-9a-f]{64}$/.test(value || '') ? value! : '';
}

/** Invitation stays in next through registration, confirmation and navigation. */
export function MarketJoinPanel({clubId, clubName='deinem Verein', onJoined}: {clubId:string;clubName?:string;onJoined:()=>void}) {
 const {user}=useAuth();const [params,setParams]=useSearchParams();
 const token=marketInviteToken(params.get('invite'));
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [teams,setTeams]=useState<Array<{id:string;name:string;age_group:string|null}>>([]),[chosen,setChosen]=useState<string[]>([]),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{setChosen([]);setAccepted(false);setError('');setTeams([]);if(!user)return;let active=true;setLoading(true);
  void supabase.rpc('exchange_team_options',{p_club_id:clubId,p_token:token}).then(r=>{if(!active)return;if(r.error)setError(r.error.message.replace(/Mannschaftsauswahl/g,'Teamauswahl'));else setTeams(r.data||[]);setLoading(false);},()=>{if(active){setError('Teams konnten nicht geladen werden.');setLoading(false);}});
  return()=>{active=false;};
 },[clubId,user?.id,token,reload]);
 const next=`/vereinsmarkt/${clubId}?${new URLSearchParams({...Object.fromEntries(params),view:'member'})}`;
 const query=new URLSearchParams({context:'vereinsmarkt',marketClub:clubId,next}).toString();
 async function join(){
  if(busy||!accepted||!chosen.length||loading)return;setBusy(true);setError('');
  try {
   const result=await supabase.rpc(token?'exchange_join':'exchange_self_join',{p_club_id:clubId,...(token?{p_token:token}:{}),p_accepted:accepted,p_team_ids:chosen});
   if(result.error)throw result.error;
   if(result.data!==true)throw new Error('Beitritt fehlgeschlagen. Bitte erneut versuchen.');
   setParams(old=>{const p=new URLSearchParams(old);p.delete('invite');p.set('view','member');return p;},{replace:true});
   requestMarketHomeGuide(clubId);
   onJoined();
  }catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'Beitritt fehlgeschlagen. Bitte erneut versuchen.');}
  finally{setBusy(false);}
 }
 return <section className="market-join" aria-label="Dem Vereinsmarkt beitreten">
  {!user&&<ol className="market-join-steps" aria-label="Anmeldung"><li data-current={!user}>1 Konto</li><li data-current={Boolean(user)}>2 Teams</li><li>3 Loslegen</li></ol>}
  <p className="public-market-eyebrow">Alle Eltern. Ein Vereinsmarkt.</p>
  <h2>Willkommen im Vereinsmarkt</h2>
  <p>Fußballsachen kaufen, verkaufen, tauschen oder verschenken.</p>
  {!user?<>
   <Link className="public-market-cta" to={marketAuthPath('register',query)}>Neu? Jetzt registrieren</Link>
   <Link className="public-market-register" to={marketAuthPath('login',query)}>Schon ein Konto? Anmelden</Link>
   <small>E-Mail bestätigen und die Teams deiner Kinder auswählen. Ein Konto genügt.</small>
  </>:<>
   {loading?<p role="status">Teams werden geladen…</p>:teams.length?<MarketTeamWizard key={`${clubId}:${user.id}:${reload}`} teams={teams} chosen={chosen} onChange={ids=>{setChosen(ids);setAccepted(false);}} busy={busy}>
   <label className="exchange-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/>Ich bin erwachsen und meine Familie gehört zu diesem Verein bzw. dieser Spielgemeinschaft.</label>
   <button type="button" className="public-market-cta" disabled={!accepted||busy||loading||!chosen.length} onClick={()=>void join()}>{busy?'Beitritt wird gespeichert…':'Dem Vereinsmarkt beitreten'}</button>
   {!loading&&!busy&&(!chosen.length||!accepted)&&<p className="market-join-action-hint">{!chosen.length?'Wähle mindestens ein Team. Danach kannst du beitreten.':'Bitte bestätige oben, dass deine Familie zum Verein gehört.'}</p>}
   </MarketTeamWizard>:error?null:<p className="exchange-hint">Hier sind noch keine Teams für die Elternauswahl freigeschaltet. Bitte wende dich an die Vereinsverwaltung oder lade die Liste später erneut.</p>}
   {!loading&&<button type="button" className="market-text-button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Teams neu laden</button>}
   <small>Deine Auswahl gilt für diesen Vereinsmarkt.</small>
  </>}
  {error&&<p role="alert" className="exchange-alert">{error}</p>}
 </section>;
}

type MarketMember={user_id:string;name:string;teams:string[];joined_at:string|null;blocked:boolean};
export function MarketMembersAdmin({clubId,userId}:{clubId:string;userId:string}){
 const [allowed,setAllowed]=useState(false),[members,setMembers]=useState<MarketMember[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[pending,setPending]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setAllowed(false);setMembers([]);setError('');setPending('');setLoading(true);
  void (async()=>{const permission=await supabase.rpc('can_manage_exchange',{p_club_id:clubId});if(permission.error)throw permission.error;if(!active)return;if(permission.data!==true){setLoading(false);return;}setAllowed(true);
   const r=await supabase.rpc('exchange_members_list',{p_club_id:clubId});if(r.error)throw r.error;if(active)setMembers(r.data||[]);
  })().catch(()=>{if(active)setError('Mitglieder konnten nicht geladen werden. Bitte erneut laden.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[clubId,userId,reload]);
 async function change(member:MarketMember){if(busy||member.user_id===userId)return;setBusy(member.user_id);setError('');try{
  const r=await supabase.rpc(member.blocked?'exchange_restore':'exchange_revoke',{p_club_id:clubId,p_user_id:member.user_id});if(r.error)throw r.error;
  setPending('');setReload(n=>n+1);
 }catch{setError('Der Zugang konnte nicht geändert werden. Bitte erneut versuchen.');}finally{setBusy('');}}
 if(!allowed)return null;
 const shown=members.filter(m=>(filter==='all'||(filter==='blocked'?m.blocked:!m.blocked))&&`${m.name} ${m.teams.join(' ')}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
 return <section className="market-join market-members" aria-label="Vereinsmarkt-Mitglieder verwalten"><p className="public-market-eyebrow">Vereinsmarkt-Verwaltung</p><h2>Mitglieder verwalten</h2><Link className="public-market-register" to={`/vereinsmarkt-manager/${clubId}`}>Vereinsmarkt-Verwaltung öffnen →</Link><p>{members.filter(m=>!m.blocked).length} aktiv · {members.filter(m=>m.blocked).length} gesperrt</p><small>Eine Sperre gilt nur für diesen Vereinsmarkt. SpielzeitApp-Konto und bestehende Team- oder Kinderzuordnungen bleiben erhalten.</small>
  <label>Name oder Team<input className="market-invite-link" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mitglied suchen…"/></label>
  <label>Zugänge anzeigen<select className="market-invite-link" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Alle Mitglieder</option><option value="active">Aktiv</option><option value="blocked">Gesperrt</option></select></label>
  <button type="button" className="market-text-button" onClick={()=>setReload(n=>n+1)} disabled={loading||Boolean(busy)}>Liste neu laden</button>
  {loading?<p role="status">Mitglieder werden geladen…</p>:shown.length?<ul className="market-member-list">{shown.map(m=><li key={m.user_id}><div><strong>{m.name}</strong><span className={m.blocked?'market-member-blocked':'market-member-active'}>{m.blocked?'Gesperrt':'Aktiv'}</span></div><p>{m.teams.length?m.teams.join(' · '):'Kein Team angegeben'}</p>
   {pending===m.user_id?<div className="market-suspend-confirm"><p>Zugang von {m.name} zum Vereinsmarkt sperren?</p><button className="public-market-cta" disabled={Boolean(busy)} onClick={()=>void change(m)}>Sperre bestätigen</button><button className="market-text-button" disabled={Boolean(busy)} onClick={()=>setPending('')}>Abbrechen</button></div>:<button type="button" className="public-market-register" disabled={Boolean(busy)||m.user_id===userId} onClick={()=>m.blocked?void change(m):setPending(m.user_id)}>{m.user_id===userId?'Dein Zugang':busy===m.user_id?'Wird gespeichert…':m.blocked?'Zugang freigeben':'Zugang sperren'}</button>}
  </li>)}</ul>:<p>Noch keine passenden Mitglieder.</p>}
  {error&&<p role="alert" className="exchange-alert">{error}</p>}
 </section>;
}

export function MarketInviteAdmin({clubId,userId}:{clubId:string;userId:string}){
 const [allowed,setAllowed]=useState(false),[link,setLink]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;setAllowed(false);setLink('');setStatus('');void supabase.rpc('can_manage_exchange',{p_club_id:clubId}).then(r=>{if(active&&!r.error)setAllowed(r.data===true);});return()=>{active=false;};},[clubId,userId]);
 async function generate(rotate=false){setBusy(true);setStatus('');try{
  const r=await supabase.rpc('exchange_invitation',{p_club_id:clubId,p_rotate:rotate});if(r.error)throw r.error;
  const data=r.data as {token:string;expires_at:string};
  if(!marketInviteToken(data.token))throw Error('Einladung konnte nicht erstellt werden.');
  setLink(`${window.location.origin}/vereinsmarkt/${clubId}?view=member&invite=${data.token}`);setExpires(data.expires_at);
  if(rotate)setStatus('Neuer Link erstellt. Der bisherige Link ist ungültig. Bereits beigetretene Eltern behalten ihren Zugang.');
 }catch(e){setStatus(e&&typeof e==='object'&&'message' in e?String(e.message):'Einladung konnte nicht erstellt werden.');}finally{setBusy(false);}}
 if(!allowed)return null;
 return <section className="market-join"><h2>Eltern zum Vereinsmarkt einladen</h2><p>Für alle Teams – ohne angelegte Kinder. Teile den Link in euren Elterngruppen.</p>
 {link?<><label>Einladungslink<input className="market-invite-link" aria-label="Einladungslink" readOnly value={link} onFocus={e=>e.target.select()}/></label><small>Gültig bis {new Date(expires).toLocaleDateString('de-AT')}.</small>
 <button className="public-market-cta" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setStatus('Link kopiert.')).catch(()=>setStatus('Bitte den Link im Feld markieren und kopieren.'))}>Link kopieren</button>
 <details><summary>Einladungslink erneuern</summary><p>Dadurch wird der bisherige Link ungültig. Bestehende Zugänge bleiben erhalten.</p><button className="public-market-register" disabled={busy} onClick={()=>void generate(true)}>Bisherigen Link ersetzen</button></details></>:<button className="public-market-cta" disabled={busy} onClick={()=>void generate()}>{busy?'Wird geladen…':'Einladungslink anzeigen'}</button>}
 {status&&<p role="status">{status}</p>}
 </section>;
}
