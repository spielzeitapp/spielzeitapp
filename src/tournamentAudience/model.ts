import type {PublicTeamTournamentPageDto} from '../lib/publicTeamTournament';
export type AudienceFixture={id:string;matchId?:string;home:string;away:string;time:string;group:string;status:string;homeGoals:number|null;awayGoals:number|null};
export const audiencePath=(id:string)=>`/turnier-app/${encodeURIComponent(id)}`;
export function audienceTeams(page:PublicTeamTournamentPageDto):string[]{
 return [...new Set([page.ownParticipantName||page.teamName,...(page.schedule??[]).flatMap(m=>[m.homeTeam,m.awayTeam]),...page.allMatches.flatMap(m=>[m.homeName||m.ourTeamName,m.awayName||m.opponentName]),...(page.groupTables??[]).flatMap(g=>g.rows.map(r=>r.teamName))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
}
export function audienceFixtures(page:PublicTeamTournamentPageDto):AudienceFixture[]{
 const local=page.allMatches.map(m=>({id:m.id,matchId:m.id,home:m.homeName||(m.ourIsHome?m.ourTeamName:m.opponentName),away:m.awayName||(m.ourIsHome?m.opponentName:m.ourTeamName),time:m.kickoffTimeLabel,group:m.groupLabel?`Gruppe ${m.groupLabel}`:'Turnierspiel',status:m.status,homeGoals:m.ourIsHome?m.scoreOur:m.scoreOpp,awayGoals:m.ourIsHome?m.scoreOpp:m.scoreOur}));
 const scheduled=(page.schedule??[]).map(m=>{
  const own=local.find(o=>o.time===m.time&&o.home===m.homeTeam&&o.away===m.awayTeam);
  return own??{id:m.id,home:m.homeTeam,away:m.awayTeam,time:m.time,group:m.roundLabel||(m.groupLabel?`Gruppe ${m.groupLabel}`:'Turnierspiel'),status:m.homeGoals!=null&&m.awayGoals!=null?'finished':'upcoming',homeGoals:m.homeGoals,awayGoals:m.awayGoals};
 });
 return [...scheduled,...local.filter(m=>!scheduled.some(s=>s.id===m.id||(s.time===m.time&&s.home===m.home&&s.away===m.away)))].sort((a,b)=>a.time.localeCompare(b.time));
}
export function readAudiencePreference(id:string){try{const value=JSON.parse(localStorage.getItem(`sz:audience:v1:${id}`)||'null');return value&&typeof value.team==='string'&&typeof value.color==='string'&&/^#[a-f\d]{6}$/i.test(value.color)?value as {team:string;color:string;secondary?:string;neutral?:boolean}:null}catch{return null}}
export function saveAudiencePreference(id:string,team:string,color:string,secondary='#ffffff',neutral=false){try{localStorage.setItem(`sz:audience:v1:${id}`,JSON.stringify({team,color,secondary,neutral}));localStorage.setItem('sz:audience:last',id)}catch{/* Browser storage is optional. */}}
