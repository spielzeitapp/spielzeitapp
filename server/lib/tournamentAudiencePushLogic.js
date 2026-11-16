import {createHash} from 'node:crypto';
export const audienceHash=value=>createHash('sha256').update(value).digest('hex');
export function validAudienceSubscription(sub){
 try {
  const u=new URL(sub?.endpoint);
  const hosts=['fcm.googleapis.com','web.push.apple.com'];
  if(u.protocol!=='https:'||u.username||u.password||u.port||sub.endpoint.length>2048||!(hosts.includes(u.hostname)||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com')))return false;
  const key=sub?.keys?.p256dh,auth=sub?.keys?.auth;
  if(!/^[\w-]{86,88}={0,2}$/.test(key)||!/^[\w-]{22}={0,2}$/.test(auth))return false;
  const bytes=Buffer.from(key,'base64url');return bytes.length===65&&bytes[0]===4&&Buffer.from(auth,'base64url').length===16;
 }catch{return false}
}
export function viennaKickoff(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||+time.slice(0,2)>23||+time.slice(3)>59)return null;
 const target=Date.parse(date+'T'+time+':00Z');let value=target;
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const parts=Object.fromEntries(fmt.formatToParts(value).map(p=>[p.type,p.value]));const represented=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);value+=target-represented;}
 return Number.isFinite(value)?new Date(value).toISOString():null;
}
export function audiencePushFixtures(page,date){
 const own=page.ownParticipantName||page.teamName;
 const aliases=new Set([own,page.teamName,...page.allMatches.map(m=>m.ourTeamName)].filter(Boolean));
 const canonical=n=>aliases.has(n)?own:n;
 const local=page.allMatches.map(m=>({key:'local:'+m.id,home:canonical(m.homeName||(m.ourIsHome?m.ourTeamName:m.opponentName)),away:canonical(m.awayName||(m.ourIsHome?m.opponentName:m.ourTeamName)),kickoff:m.kickoffAt,time:m.kickoffTimeLabel,status:m.status,phase:m.phase||m.groupLabel||''}));
 const schedule=(page.schedule||[]).map((m,i)=>{const home=canonical(m.homeTeam),away=canonical(m.awayTeam),reported=local.find(l=>l.home===home&&l.away===away&&l.time===m.time);return {key:'schedule:'+(m.id||`${home}|${away}|${m.phase}|${i}`),home,away,kickoff:reported?.kickoff||viennaKickoff(date,m.time),time:m.time,status:reported?.status||(m.homeGoals!=null&&m.awayGoals!=null?'finished':'upcoming'),phase:m.roundLabel||m.phase||''}});
 return [...schedule,...local.filter(l=>!schedule.some(m=>m.home===l.home&&m.away===l.away&&m.time===l.time))].filter(m=>m.home&&m.away&&Number.isFinite(Date.parse(m.kickoff))).slice(0,200);
}
export function audiencePushPlan(previous,fixtures,team,now=Date.now()){
 const current=fixtures.filter(m=>!team||m.home===team||m.away===team);
 const next=current.filter(m=>m.status==='upcoming'&&Date.parse(m.kickoff)>now).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
 const snapshot={fixtures:Object.fromEntries(current.map(m=>[m.key,m])),reminded:Object.fromEntries(current.filter(m=>previous?.reminded?.[m.key]).map(m=>[m.key,previous.reminded[m.key]]))};
 const notifications=[];
 if(previous?.fixtures){
  const changed=next.filter(m=>{const old=previous.fixtures[m.key];return !old||old.kickoff!==m.kickoff||old.home!==m.home||old.away!==m.away||old.phase!==m.phase});
  const removed=Object.values(previous.fixtures).some(m=>m.status==='upcoming'&&Date.parse(m.kickoff)>now&&!snapshot.fixtures[m.key]);
  if(changed.length||removed){const m=changed[0];notifications.push({title:m&&/final|halb|platz|semi|knockout/i.test(m.phase)?'Dein nächstes Final- oder Platzierungsspiel':'Spielplan aktualisiert',body:m?`${m.home} – ${m.away} · ${m.time} Uhr. Jetzt den Spielplan prüfen.`:'Ein geplantes Spiel wurde entfernt. Prüfe den aktuellen Spielplan.',tag:'plan-'+audienceHash(JSON.stringify(snapshot.fixtures)).slice(0,24)});}
 }
 const imminent=next[0];
 if(imminent&&Date.parse(imminent.kickoff)-now<=300000&&snapshot.reminded[imminent.key]!==imminent.kickoff){
  notifications.push({title:'Dein Spiel beginnt in Kürze',body:`${imminent.home} – ${imminent.away} · ${imminent.time} Uhr. Jetzt zum Spielfeld!`,tag:'start-'+audienceHash(imminent.key+imminent.kickoff).slice(0,24)});
  snapshot.reminded[imminent.key]=imminent.kickoff;
 }
 return {snapshot,notifications};
}
