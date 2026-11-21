import {MarketManagerNav} from '../features/marketManager/MarketManagerNav';
import React,{useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../lib/supabaseClient';
import {useSession} from '../auth/useSession';
import {resolveClubIdForTeamSeason} from '../lib/venues';
import {MarketThemeToggle} from '../features/club/MarketThemeToggle';
import {TestEnvironmentNotice} from '../components/TestEnvironmentNotice';
import {isStagingApp} from '../lib/appEnvironment';
import './managerMarketTeams.css';
import { MarketTeamsSettings } from './MarketTeamsSettings';
export function ManagerMarketTeamsPage(){
 const [params,setParams]=useSearchParams();const {viewTeamSeasonId,selectedTeamSeasonId}=useSession();
 const [contextClub,setContextClub]=useState(''),[clubs,setClubs]=useState<{id:string;name:string}[]>([]),[error,setError]=useState('');
 const clubId=params.get('club')||contextClub;
 useEffect(()=>{let active=true;const season=viewTeamSeasonId??selectedTeamSeasonId;setContextClub('');if(season)void resolveClubIdForTeamSeason(season).then(r=>{if(active)setContextClub(r.clubId||'');}).catch(()=>{});return()=>{active=false;};},[viewTeamSeasonId,selectedTeamSeasonId]);
 useEffect(()=>{let active=true;void supabase.from('clubs').select('id,name').eq('status','active').order('name').limit(500).then(r=>{if(!active)return;if(r.error)setError('Vereine konnten nicht geladen werden.');else setClubs(r.data||[]);});return()=>{active=false;};},[]);
 return <main className={params.get('from')==='vereinsmarkt-manager'?'manager-market-teams market-manager-with-nav':'manager-market-teams'}>{isStagingApp()&&<TestEnvironmentNotice/>}<div className="manager-market-teams-inner"><div className="manager-market-teams-top"><Link to={params.get('from')==='vereinsmarkt-manager'?`/vereinsmarkt-manager/${clubId}`:'/manager'}>← {params.get('from')==='vereinsmarkt-manager'?'Vereinsmarkt-Manager':'Vereinszentrale'}</Link><MarketThemeToggle/></div><header className="manager-market-teams-heading"><img src="/vereinsmarkt/icon-180.png" width="52" height="52" alt=""/><div><span>VEREINSMARKT · VERWALTUNG</span><h1>Mannschaftsauswahl für Eltern</h1></div></header><p className="manager-market-teams-intro">Lege fest, welche Teams Eltern beim Beitritt auswählen können. Bestehende Zuordnungen bleiben erhalten.</p><label>Verein<select value={clubId} onChange={e=>setParams({club:e.target.value})}><option value="">Verein auswählen</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}{c.id==='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a'?' · Vereinsmarkt NSG Gölsental':''}</option>)}</select></label>{error&&<p role="alert">{error}</p>}{clubId&&<MarketTeamsSettings key={clubId} clubId={clubId}/>}</div>{params.get('from')==='vereinsmarkt-manager'&&clubId&&<MarketManagerNav clubId={clubId} section="teams"/>}</main>;
}
