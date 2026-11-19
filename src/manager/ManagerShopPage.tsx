import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { ClubShop } from '../features/club/ClubShop';
import { marketDisplayName } from '../features/club/marketIdentity';
import { isStagingApp } from '../lib/appEnvironment';
import { supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import './managerShop.css';

/** Dedicated shop route grants no access to other Manager modules. Shop RPC checks club rights. */
export function ManagerShopPage(){
 const navigate=useNavigate();
 const [params,setParams]=useSearchParams();
 const {viewTeamSeasonId,selectedTeamSeasonId}=useSession();
 const [clubs,setClubs]=useState<{id:string;name:string}[]>([]),[contextClub,setContextClub]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const clubId=params.get('club')||contextClub;
 useEffect(()=>{let active=true;const season=viewTeamSeasonId??selectedTeamSeasonId;setContextClub('');if(season)void resolveClubIdForTeamSeason(season).then(r=>{if(active)setContextClub(r.clubId||'');}).catch(()=>{});return()=>{active=false;};},[viewTeamSeasonId,selectedTeamSeasonId]);
 useEffect(()=>{if(!isStagingApp()){setLoading(false);return;}let active=true;void supabase.from('clubs').select('id,name').eq('status','active').order('name').limit(500).then(r=>{if(!active)return;if(r.error)setError('Vereine konnten nicht geladen werden. Bitte Seite neu laden.');else setClubs(r.data||[]);setLoading(false);});return()=>{active=false;};},[]);
 const club=clubs.find(c=>c.id===clubId);
 return <main className="manager-shop-page"><div className="manager-shop-top"><Link to="/manager">← Vereinszentrale</Link><span>Spielzeit Manager{isStagingApp()?' · TEST':''}</span></div><header><ShoppingBag/><h1>Vereinsshop · Artikelverwaltung</h1><p>Sortiment, Größen und Preise einstellen. Bestehende Artikel bearbeiten und sichtbar schalten.</p></header>
 {!isStagingApp()?<p>Die Artikelverwaltung wird auf TEST vorbereitet.</p>:<><label className="manager-shop-selector">Shop für Verein<select value={clubId} disabled={loading} onChange={e=>setParams({club:e.target.value})}><option value="">{loading?'Vereine werden geladen …':'Bitte Verein auswählen'}</option>{clubs.map(c=><option key={c.id} value={c.id}>{marketDisplayName(c.id,c.name)}</option>)}</select></label>{error&&<p role="alert">{error}</p>}{club&&<><p className="manager-shop-help">Die Verwaltung ist nur für Vereinsadmins und den vom Verein zugeordneten Shopverantwortlichen freigeschaltet. Produktfotos derzeit per Bildlink.</p><ClubShop key={club.id} manageOnly clubId={club.id} clubName={marketDisplayName(club.id,club.name)} onBack={()=>navigate('/manager')}/><Link className="manager-shop-preview" to={`/marktplatz/${club.id}?view=shop`}>Shop aus Sicht der Familien öffnen →</Link></>}</>}
 </main>;
}
