import { useEffect, useState, type CSSProperties } from 'react';
import { getClubBrandingForTeamSeason, hexToRgbChannels, readableAccentOnDark, readableTextColor, type ClubBranding } from '../lib/clubBranding';
/** Match/post season is authoritative, including in mixed-club feeds. */
export function useMatchClubBranding(seasonId?: string|null) {
 const [state,setState]=useState<{id:string;brand:ClubBranding|null}|null>(null);
 useEffect(()=>{if(!seasonId)return;let active=true;void getClubBrandingForTeamSeason(seasonId).then(r=>{if(active)setState({id:seasonId,brand:r.data});});return()=>{active=false;};},[seasonId]);
 const brand=state && state.id===seasonId?state.brand:null;
 const style={
  '--match-primary':brand?.primary_color ? hexToRgbChannels(brand.primary_color) : 'var(--club-primary-rgb, 17 17 20)',
  '--match-accent':brand?.accent_color ? hexToRgbChannels(brand.accent_color) : 'var(--club-accent-rgb, 200 35 51)',
  '--club-primary-rgb': brand?.primary_color ? hexToRgbChannels(brand.primary_color) : undefined,
  '--club-accent-rgb': brand?.accent_color ? hexToRgbChannels(brand.accent_color) : undefined,
  '--club-accent-text-rgb': brand?.accent_color ? readableAccentOnDark(brand.accent_color) : undefined,
  '--club-secondary-rgb': brand?.secondary_color ? hexToRgbChannels(brand.secondary_color) : undefined,
  '--club-on-accent': brand?.accent_color ? readableTextColor(brand.accent_color) : undefined,
  '--club-on-primary': brand?.primary_color ? readableTextColor(brand.primary_color) : undefined,
  '--club-border-rgb': brand?.accent_color ? hexToRgbChannels(brand.accent_color) : undefined,
 } as CSSProperties;
 return {brand,style};
}
