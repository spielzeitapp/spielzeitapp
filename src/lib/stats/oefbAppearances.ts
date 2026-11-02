import {supabase} from '../supabaseClient';
type Player={name:string;externalPlayerId:string|null};
type Report={score:string|null;homePlayers:Player[];awayPlayers:Player[];events:{type:string;side:string|null;player:string;secondPlayer:string}[]};
type Link={team_season_id:string;external_player_id:string;player_id:string;source_name:string};
const key=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('de').replace(/\s+/g,' ').trim();
/** Only confirmed season-scoped identities; a bench listing alone is not an appearance. */
export function reportAppearances(report:Report,home:boolean,links:Link[]):{playerId:string;starter:boolean}[]{
 const found=new Map<string,boolean>();
 const identify=(p:Player)=>links.find(l=>l.external_player_id===p.externalPlayerId)?.player_id;
 for(const p of home?report.homePlayers:report.awayPlayers){const id=identify(p);if(id)found.set(id,true);}
 for(const e of report.events){if(e.type!=='playerchange'||e.side!==(home?'home':'away')||!e.secondPlayer)continue;
  for(const name of [e.player,e.secondPlayer]){
  const candidates=new Set(links.filter(l=>key(l.source_name)===key(name)).map(l=>l.player_id));
  if(candidates.size===1){const id=[...candidates][0];if(!found.has(id))found.set(id,false);}}
 }
 return [...found].map(([playerId,starter])=>({playerId,starter}));
}
const cache=new Map<string,{until:number;promise:Promise<Report>}>();
async function loadReport(id:string):Promise<Report>{
 const cached=cache.get(id);if(cached&&cached.until>Date.now())return cached.promise;
 const promise=fetch('/api/oefb/table?view=report&id='+encodeURIComponent(id),{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('ÖFB-Spielbericht nicht erreichbar');return r.json() as Promise<Report>;}).catch(e=>{cache.delete(id);throw e;});
 if(cache.size>100)cache.clear();cache.set(id,{until:Date.now()+60000,promise});return promise;
}
export async function fetchOefbAppearances(matchIds:string[],nativeMatches:Set<string>){
 const {data:fixtures,error}=await supabase.from('events').select('match_id,team_season_id,external_id,is_home,matches(score_home,score_away)').eq('external_source','oefb').in('match_id',matchIds);
 if(error)throw Error(error.message);
 if(!fixtures?.length)return [];
 const seasons=[...new Set(fixtures.map(e=>e.team_season_id))];
 const {data:links,error:linkError}=await supabase.rpc('read_oefb_stat_links',{p_team_season_ids:seasons});
 if(linkError)throw Error(linkError.message);
 const rows: {match_id:string;type:string;minute:null;player_id:string;payload:{source:string;starter:boolean}}[]=[];
 // Bound simultaneous public requests; no database/live-event writes.
 for(let i=0;i<fixtures.length;i+=3)await Promise.all(fixtures.slice(i,i+3).map(async e=>{
  if(!e.match_id||nativeMatches.has(e.match_id)||typeof e.is_home!=='boolean'||!/^\d{1,10}$/.test(e.external_id||''))return;
  const report=await loadReport(e.external_id!);const match=Array.isArray(e.matches)?e.matches[0]:e.matches;
  if(!match||report.score!==`${match.score_home}:${match.score_away}`)throw Error('ÖFB-Ergebnis stimmt nicht mit dem importierten Spiel überein. Bitte Import prüfen.');
  for(const p of reportAppearances(report,e.is_home,((links??[]) as Link[]).filter(l=>l.team_season_id===e.team_season_id)))rows.push({match_id:e.match_id,type:'oefb_appearance',minute:null,player_id:p.playerId,payload:{source:'oefb_attribution',starter:p.starter}});
 }));
 return rows;
}
