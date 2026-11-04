import React,{useEffect,useState} from 'react';
import {ProfileHeroCard} from '../components/team/profile/ProfileHeroCard';
import {supabase} from '../lib/supabaseClient';
import {getOurTeamLogoUrl} from '../lib/teamLogos';
import type {PlayerPhotoLayout} from '../lib/playerPhotoLayout';
export function ManagerProfilePhotoPreview({seasonId,layout,photoUrl,cutoutUrl,firstName,lastName,number,trainer}:{seasonId:string;layout:PlayerPhotoLayout;photoUrl?:string|null;cutoutUrl?:string|null;firstName:string;lastName:string;number?:number|null;trainer:boolean}){
 const [header,setHeader]=useState({team:'',label:''});
 useEffect(()=>{let active=true;setHeader({team:'',label:''});
  void (async()=>{try{
   const {data,error}=await supabase.from('team_seasons').select('age_group, teams(name), seasons(name)').eq('id',seasonId).single();
   if(!active||error||!data)return;
   const team=Array.isArray(data.teams)?data.teams[0]:data.teams;
   const season=Array.isArray(data.seasons)?data.seasons[0]:data.seasons;
   setHeader({team:team?.name||'',label:[team?.name,data.age_group,season?.name].filter(Boolean).join(' · ')});
  }catch{/* The editor remains usable if season metadata is temporarily unavailable. */}})();
  return()=>{active=false;};
 },[seasonId]);
 return <ProfileHeroCard variant={trainer?'trainer':'player'} photoLayout={layout} watermark={trainer?'TR':number==null?'':String(number)} firstNameLine={firstName} lastNameLine={lastName} teamName={header.team} teamSeasonLabel={header.label} teamLogoUrl={getOurTeamLogoUrl()} photoUrl={photoUrl} cutoutUrl={cutoutUrl} initials={[firstName[0],lastName[0]].filter(Boolean).join('')}/>;
}
