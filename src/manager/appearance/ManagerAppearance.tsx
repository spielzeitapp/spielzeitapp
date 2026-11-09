import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { getClubBranding, getClubBrandingForTeamSeason, type ClubBranding } from '../../lib/clubBranding';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { APPEARANCE_KEY, parseAppearance, clubAppearance, type AppearanceMode } from './clubAppearance';

const AppearanceContext = createContext<{mode:AppearanceMode;toggle:()=>void;branding:ClubBranding|null;clubName:string|null}>({mode:'night',toggle:()=>{},branding:null,clubName:null});
export function useManagerAppearance(){ return useContext(AppearanceContext); }

/** Local theme scope: never writes app session, club settings, or global CSS variables. */
export function ManagerAppearance({children,modern=false}:{children:React.ReactNode;modern?:boolean}) {
  const location=useLocation();
  const {selectedTeamSeasonId,viewTeamSeasonId,selectedTeamSeason,viewTeamSeason}=useSession();
  const {supportSession,workMode}=useManagerWorkMode();
  const routeClub=/^\/manager\/vereine\/([^/]+)\/?$/.exec(location.pathname)?.[1] ?? null;
  const platform=workMode==='platform_admin'&&!supportSession;
  const clubId=routeClub ?? supportSession?.clubId ?? null;
  const teamId=platform ? null : viewTeamSeasonId ?? selectedTeamSeasonId;
  const scope=clubId?`club:${clubId}`:teamId?`team:${teamId}`:null;
  const [loaded,setLoaded]=useState<{scope:string;branding:ClubBranding|null}|null>(null);
  const [mode,setMode]=useState<AppearanceMode>(()=>{try{return parseAppearance(localStorage.getItem(APPEARANCE_KEY));}catch{return 'night';}});
  const branding=loaded?.scope===scope?loaded.branding:null;
  const [brandingRevision,setBrandingRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setBrandingRevision(v=>v+1);window.addEventListener('spielzeit:club-branding-changed',refresh);return()=>window.removeEventListener('spielzeit:club-branding-changed',refresh);},[]);
  // Discard a previous club immediately, including while a slow request is in flight.
  useEffect(()=>{let active=true;if(!scope)return;const request=clubId?getClubBranding(clubId):getClubBrandingForTeamSeason(teamId!);
    void request.then(result=>{if(active)setLoaded({scope,branding:result.error?null:result.data});}).catch(()=>{if(active)setLoaded({scope,branding:null});});
    return()=>{active=false;};
  },[scope,clubId,teamId,brandingRevision]);
  useEffect(()=>{try{localStorage.setItem(APPEARANCE_KEY,mode);}catch{/* Private browsing still supports the toggle in memory. */}},[mode]);
  useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===APPEARANCE_KEY)setMode(parseAppearance(e.newValue));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  const palette=clubAppearance(branding?.primary_color??null,branding?.secondary_color??null,branding?.accent_color??null,mode);
  const context=viewTeamSeason??selectedTeamSeason;
  const clubRecord=Array.isArray(context?.team?.clubs)?context?.team?.clubs[0]:context?.team?.clubs;
  const clubName=supportSession?.clubName ?? (!platform ? (modern?clubRecord?.name:null)??context?.team?.name??null : null);
  const value=useMemo(()=>({mode,toggle:()=>setMode(v=>v==='day'?'night':'day'),branding,clubName}),[mode,branding,clubName]);
  const style={'--manager-club-primary':palette.primary,'--manager-club-secondary':palette.secondary,'--manager-action':palette.accent,'--manager-on-action':palette.onAccent,'--manager-link':palette.link,
    '--club-primary-rgb':palette.primaryRgb,'--club-secondary-rgb':palette.secondaryRgb,'--club-accent-rgb':palette.accentRgb,'--club-border-rgb':palette.accentRgb,'--club-accent-text-rgb':palette.darkAccent.slice(1).match(/../g)!.map(x=>parseInt(x,16)).join(' '),'--club-on-accent':palette.onAccent,...(modern?{'--accent':palette.accent,'--secondary':palette.primary,'--accent-ink':palette.onAccent}:{})} as React.CSSProperties;
  return <AppearanceContext.Provider value={value}><div data-manager-modern={modern ? "true" : undefined} data-manager-appearance={mode} data-manager-club={scope??'platform'} style={style} className={"manager-shell manager-club-workspace flex min-h-[100dvh] w-full min-w-0 flex-1 max-md:h-[100dvh] max-md:overflow-hidden"+(modern?" szc-app":"")}>{children}</div></AppearanceContext.Provider>;
}
export function ManagerAppearanceToggle(){
  const {mode,toggle}=useManagerAppearance();
  return <button type="button" className="manager-appearance-toggle" onClick={toggle} aria-label={mode==='night'?'Tagansicht aktivieren':'Nachtansicht aktivieren'} title={mode==='night'?'Zur Tagansicht wechseln':'Zur Nachtansicht wechseln'}>{mode==='night'?<Sun size={18} aria-hidden/>:<Moon size={18} aria-hidden/>}<span>{mode==='night'?'Tag':'Nacht'}</span></button>;
}
