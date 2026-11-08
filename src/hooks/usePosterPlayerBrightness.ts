import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {portraitBrightness} from '../lib/playerPhotoLayout';
/** Matchday posters share the selected player's saved season appearance. */
export function usePosterPlayerBrightness(playerId?:string|null,seasonId?:string|null,imageUrl?:string|null) {
 const key=`${seasonId}:${playerId}:${imageUrl}`;
 const [state,setState]=useState<{key:string;value:number}|null>(null);
 useEffect(()=>{if(!playerId||!seasonId)return;let active=true;
 if(imageUrl&&/[.](matchday|celebration)[.]/.test(imageUrl)){
 void supabase.from('player_photo_motifs').select('layout,original_url,cutout_url').eq('team_season_id',seasonId).eq('player_id',playerId).then(({data,error})=>{if(!active)return;const motif=data?.find(m=>m.original_url===imageUrl||m.cutout_url===imageUrl);setState({key,value:error?100:portraitBrightness(motif?.layout?.brightness)});});return()=>{active=false;};
 }
 void supabase.from('team_season_players').select('photo_layout,team_seasons(photo_layout_default)').eq('team_season_id',seasonId).eq('player_id',playerId).maybeSingle().then(({data,error})=>{
  if(!active)return;
  const season=Array.isArray(data?.team_seasons)?data.team_seasons[0]:data?.team_seasons;
  const layout=data?.photo_layout??season?.photo_layout_default;
  setState({key,value:error?100:portraitBrightness((layout as {brightness?:number}|null)?.brightness)});
 });return()=>{active=false;};},[key,playerId,seasonId,imageUrl]);
 return state?.key===key?state.value:100;
}
