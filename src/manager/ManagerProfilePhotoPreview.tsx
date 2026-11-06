import React,{useEffect,useState} from 'react';
import {ProfileHeroCard} from '../components/team/profile/ProfileHeroCard';
import {supabase} from '../lib/supabaseClient';
import {hexToRgbChannels,DEFAULT_CLUB_BRANDING} from '../lib/clubBranding';
import type {PlayerPhotoLayout} from '../lib/playerPhotoLayout';
export function ManagerProfilePhotoPreview({seasonId,layout,photoUrl,cutoutUrl,firstName,lastName,number,trainer,clubTemplate}:{seasonId:string;layout:PlayerPhotoLayout;photoUrl?:string|null;cutoutUrl?:string|null;firstName:string;lastName:string;number?:number|null;trainer:boolean;clubTemplate?:'wide'|'square'}){
 const [header,setHeader]=useState({team:'',label:'',logo:null as string|null,colors:{} as React.CSSProperties,template:undefined as 'wide'|'square'|undefined});
 useEffect(()=>{let active=true;setHeader({team:'',label:'',logo:null as string|null,colors:{} as React.CSSProperties,template:undefined as 'wide'|'square'|undefined});
  void (async()=>{try{
   const {data,error}=await supabase.from('team_seasons').select('age_group, teams(name,clubs(player_photo_template,logo_url,primary_color,secondary_color,accent_color)), seasons(name)').eq('id',seasonId).single();
   if(!active||error||!data)return;
   const team=Array.isArray(data.teams)?data.teams[0]:data.teams;
   const season=Array.isArray(data.seasons)?data.seasons[0]:data.seasons;
   const club=Array.isArray((team as any)?.clubs)?(team as any).clubs[0]:(team as any)?.clubs;
   setHeader({logo:club?.logo_url??null,colors:{'--club-primary-rgb':hexToRgbChannels(club?.primary_color??DEFAULT_CLUB_BRANDING.primary_color!),'--club-border-rgb':hexToRgbChannels(club?.accent_color??DEFAULT_CLUB_BRANDING.accent_color!),'--club-accent-rgb':hexToRgbChannels(club?.accent_color??DEFAULT_CLUB_BRANDING.accent_color!)} as React.CSSProperties,template:club?.player_photo_template,team:team?.name||'',label:[team?.name,data.age_group,season?.name].filter(Boolean).join(' · ')});
  }catch{/* The editor remains usable if season metadata is temporarily unavailable. */}})();
  return()=>{active=false;};
 },[seasonId]);
 return <div data-manager-artwork style={header.colors}><ProfileHeroCard clubTemplate={clubTemplate??header.template} variant={trainer?'trainer':'player'} photoLayout={layout} watermark={trainer?'TR':number==null?'':String(number)} firstNameLine={firstName} lastNameLine={lastName} teamName={header.team} teamSeasonLabel={header.label} teamLogoUrl={header.logo} photoUrl={photoUrl} cutoutUrl={cutoutUrl} initials={[firstName[0],lastName[0]].filter(Boolean).join('')}/></div>;
}
