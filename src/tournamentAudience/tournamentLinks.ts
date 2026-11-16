const idPattern=/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|ev-tournament)$/i;
export function audienceTournamentId(raw:string):string|null{
 const value=raw.trim();if(idPattern.test(value))return value;
 try{const url=new URL(value,'https://spielzeitapp.at');if(!['spielzeitapp.at','www.spielzeitapp.at','app.spielzeitapp.at'].includes(url.hostname)||url.protocol!=='https:'||url.username||url.password)return null;const match=/^\/(?:turnier|turnier-app)\/([^/]+)\/?$/.exec(url.pathname);const id=match?decodeURIComponent(match[1]):'';return idPattern.test(id)?id:null}catch{return null}
}
export type SavedAudienceTournament={id:string;name:string;date:string};
export function savedAudienceTournaments():SavedAudienceTournament[]{try{const rows=JSON.parse(localStorage.getItem('sz:audience:recents:v1')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.id==='string'&&idPattern.test(r.id)&&typeof r.name==='string'&&typeof r.date==='string').slice(0,12):[]}catch{return []}}
export function rememberAudienceTournament(entry:SavedAudienceTournament){try{localStorage.setItem('sz:audience:recents:v1',JSON.stringify([entry,...savedAudienceTournaments().filter(r=>r.id!==entry.id)].slice(0,12)))}catch{}}
