import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {audienceHash,validAudienceSubscription,audiencePushFixtures,audiencePushPlan} from './tournamentAudiencePushLogic.js';
import {loadPublicTeamTournamentPage} from './publicTeamTournamentPage.js';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const origin='https://app.spielzeitapp.at';
const check=result=>{if(result.error)throw new Error('storage');return result.data};
function vapid(){const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;if(!publicKey||!privateKey||!subject||String(process.env.STAGING_DISABLE_OUTBOUND).toLowerCase()==='true')return null;return {publicKey,privateKey,subject}}
function payload(eventId,n){return JSON.stringify({...n,icon:'/turnier-app/clock-icon-192.png',badge:'/badge-72.png',data:{url:'/turnier-app/'+eventId}})}
async function context(db,eventId){
 const event=check(await db.from('events').select('kind,status,starts_at,notes,tournament_completed_at').eq('id',eventId).maybeSingle());
 if(!event||event.kind!=='tournament'||['cancelled','canceled','deleted','finished'].includes(event.status)||event.tournament_completed_at)return null;
 const result=await loadPublicTeamTournamentPage(eventId);if(!result.ok)return null;
 const date=String(event.notes||'').match(/^Turnierdatum: (20\d{2}-\d{2}-\d{2})$/m)?.[1]||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date(event.starts_at));
 return {page:result.page,fixtures:audiencePushFixtures(result.page,date),date};
}
async function dispatch(db,ticket){
 if(!uuid.test(ticket||''))return {denied:true};
 const consumed=check(await db.from('tournament_audience_push_tickets').delete().eq('id',ticket).gt('expires_at',new Date().toISOString()).select('id'));
 if(!consumed?.length)return {denied:true};
 const cfg=vapid();if(!cfg)return {disabled:true,sent:0};webpush.setVapidDetails(cfg.subject,cfg.publicKey,cfg.privateKey);
 const subscriptions=check(await db.rpc('tournament_audience_push_claim'))||[];
 const pages=new Map(),started=Date.now();let sent=0,failed=0;
 for(const sub of subscriptions){
  if(Date.now()-started>35000)break;
  try{
   if(!pages.has(sub.event_id))pages.set(sub.event_id,await context(db,sub.event_id));
   const ctx=pages.get(sub.event_id);if(!ctx)continue;
   const plan=audiencePushPlan(sub.snapshot,ctx.fixtures,sub.team);
   // Recheck the current capability after claiming: team switches/revocations invalidate this lease.
   const current=check(await db.from('tournament_audience_push').select('id').eq('id',sub.id).eq('team',sub.team).eq('lease_until',sub.lease_until).maybeSingle());if(!current)continue;
   for(const n of plan.notifications){await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload(sub.event_id,n),{TTL:300,timeout:8000});sent++}
   check(await db.from('tournament_audience_push').update({snapshot:plan.snapshot,lease_until:new Date().toISOString()}).eq('id',sub.id).eq('lease_until',sub.lease_until));
  }catch(e){failed++;if(e?.statusCode===404||e?.statusCode===410)await db.from('tournament_audience_push').delete().eq('id',sub.id).eq('lease_until',sub.lease_until);}
 }
 return {sent,failed,processed:subscriptions.length};
}
export default async function audiencePush(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url?.replace(/\/$/,'')!=='https://acbaecjzoabafbsjrzvr.supabase.co'||!key)return res.status(503).json({error:'Turnier-Push ist nur in TEST verfügbar.'});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),action=String(req.query?.audiencePush||'');
  if(action==='config'&&req.method==='GET'){
   const cfg=vapid(),probe=await db.from('tournament_audience_push').select('id',{head:true,count:'exact'});
   return res.status(200).json({ready:!!cfg&&!probe.error,publicKey:cfg&&!probe.error?cfg.publicKey:null});
  }
  if(req.method!=='POST')return res.status(405).json({error:'POST erforderlich.'});
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(raw)>8192)return res.status(413).json({error:'Anfrage zu groß.'});
  let body;try{body=JSON.parse(raw)}catch{return res.status(400).json({error:'Ungültige Anfrage.'})}
  if(action==='dispatch'){const result=await dispatch(db,body.ticket);return res.status(result.denied?403:200).json(result.denied?{error:'Nicht erlaubt.'}:result)}
  if(req.headers.origin!==origin||!String(req.headers['content-type']||'').includes('application/json'))return res.status(403).json({error:'Bitte direkt in der Turnier-App öffnen.'});
  if(!['subscribe','status','unsubscribe','test'].includes(action)||!uuid.test(body.eventId||'')||!/^[-\w]{43}$/.test(body.device||''))return res.status(400).json({error:'Ungültige Geräteanmeldung.'});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const allowed=check(await db.rpc('tournament_audience_push_rate',{p_key:audienceHash(key+ip)}));if(!allowed)return res.status(429).json({error:'Zu viele Versuche. Bitte später erneut versuchen.'});
  const deviceHash=audienceHash(body.device),query=()=>db.from('tournament_audience_push').select('id,team,endpoint,p256dh,auth,expires_at').eq('device_hash',deviceHash).eq('event_id',body.eventId).maybeSingle();
  if(action==='status'){const sub=check(await query());return res.status(200).json({active:!!sub&&Date.parse(sub.expires_at)>Date.now(),team:sub?.team??null})}
  if(action==='unsubscribe'){check(await db.from('tournament_audience_push').delete().eq('device_hash',deviceHash).eq('event_id',body.eventId));return res.status(200).json({active:false})}
  const cfg=vapid();if(!cfg)return res.status(503).json({error:'Push-Versand ist derzeit nicht freigeschaltet.'});
  if(action==='test'){
   const sub=check(await query());if(!sub||Date.parse(sub.expires_at)<=Date.now())return res.status(404).json({error:'Bitte Benachrichtigungen erneut aktivieren.'});
   webpush.setVapidDetails(cfg.subject,cfg.publicKey,cfg.privateKey);
   try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload(body.eventId,{title:'Spielzeit Turniere · Test',body:'Deine Benachrichtigungen sind eingerichtet.',tag:'audience-test-'+sub.id}),{TTL:60,timeout:8000})}
   catch(e){if(e?.statusCode===404||e?.statusCode===410){await db.from('tournament_audience_push').delete().eq('id',sub.id);return res.status(410).json({error:'Geräteanmeldung abgelaufen. Bitte erneut aktivieren.'})}throw e}
   return res.status(200).json({sent:true});
  }
  if(!validAudienceSubscription(body.subscription)||typeof body.team!=='string'||body.team.length>160)return res.status(400).json({error:'Ungültige Push-Anmeldung.'});
  const ctx=await context(db,body.eventId);if(!ctx)return res.status(404).json({error:'Für dieses Turnier sind keine Erinnerungen verfügbar.'});
  const teams=new Set([...ctx.fixtures.flatMap(m=>[m.home,m.away]),ctx.page.ownParticipantName,ctx.page.teamName,...(ctx.page.groupTables||[]).flatMap(g=>g.rows.map(r=>r.teamName))]);if(body.team&&!teams.has(body.team))return res.status(400).json({error:'Bitte eine teilnehmende Mannschaft wählen.'});
  if(Date.parse(ctx.date+'T23:59:59Z')+2*86400000<=Date.now())return res.status(400).json({error:'Dieses Turnier ist bereits beendet.'});
  const snapshot=audiencePushPlan(null,ctx.fixtures,body.team).snapshot;snapshot.reminded={};
  const result=await db.from('tournament_audience_push').upsert({device_hash:deviceHash,event_id:body.eventId,team:body.team,endpoint:body.subscription.endpoint,p256dh:body.subscription.keys.p256dh,auth:body.subscription.keys.auth,snapshot,lease_until:'-infinity',expires_at:new Date(Math.min(Date.now()+45*86400000,Date.parse(ctx.date+'T23:59:59Z')+2*86400000)).toISOString()},{onConflict:'device_hash,event_id'});
  if(result.error){if(result.error.code==='23505')return res.status(409).json({error:'Dieses Gerät ist bereits registriert. Bitte die ursprüngliche App-Ansicht verwenden.'});throw result.error}
  return res.status(200).json({active:true,team:body.team});
 }catch{return res.status(503).json({error:'Push derzeit nicht erreichbar. Bitte erneut versuchen.'})}
}
