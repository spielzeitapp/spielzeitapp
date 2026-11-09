import { supabase } from './supabaseClient';
export type LifecycleSnapshot = {
 source_id:string;team_id:string;club_name:string;team_name:string;season_name:string;status:string;age_group:string|null;
 next_season_name:string|null;next_age_group:string|null;target_id:string|null;target_status:string|null;target_season_name:string|null;target_age_group:string|null;
 known_games:number;open_games:number;running_games:number;last_game_at:string|null;possible_end:boolean;fingerprint:string;snoozed_until:string|null;
 roster:Array<{id:string;name:string;number:number|null;roster_status?:string}>;
};
export function parseOefbSeasonTarget(url:string): {name:string;age:string}|null {
 try {const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='vereine.oefb.at')return null;
 const m=u.pathname.match(/\/Mannschaften\/Saison-(20\d{2})-(\d{2})\/([A-Za-z0-9_-]+)\//);
 if(!m||Number(m[2])!==(Number(m[1])+1)%100)return null;return{name:m[1]+'/'+m[2],age:m[3].split(/[_-]/)[0]};
 }catch{return null;}
}
export async function resolveEventSeason(sourceId:string,input:{date?:string;name?:string;age?:string}) {
 const r=await supabase.rpc('resolve_event_team_season',{p_source:sourceId,p_date:input.date??null,p_name:input.name??null,p_age:input.age??null});
 if(r.error)throw new Error(r.error.message);return r.data as {team_season_id:string;prepared:boolean;season_name:string};
}
export function shouldShowLifecycle(s:LifecycleSnapshot,now=Date.now()) {
 return (!s.snoozed_until||Date.parse(s.snoozed_until)<=now)&&(s.possible_end||s.target_status==='draft');
}
