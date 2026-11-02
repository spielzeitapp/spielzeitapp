import { useEffect, useState, type CSSProperties } from 'react';
import { getClubBrandingForTeamSeason, hexToRgbChannels, type ClubBranding } from '../lib/clubBranding';
/** Match/post season is authoritative, including in mixed-club feeds. */
export function useMatchClubBranding(seasonId?: string|null) {
 const [state,setState]=useState<{id:string;brand:ClubBranding|null}|null>(null);
 useEffect(()=>{if(!seasonId)return;let active=true;void getClubBrandingForTeamSeason(seasonId).then(r=>{if(active)setState({id:seasonId,brand:r.data});});return()=>{active=false;};},[seasonId]);
 const brand=state && state.id===seasonId?state.brand:null;
 const style={
  '--match-primary':hexToRgbChannels(brand?.primary_color||'#111114'),
  '--match-accent':hexToRgbChannels(brand?.accent_color||'#C82333'),
 } as CSSProperties;
 return {brand,style};
}
