import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalFetch = globalThis.fetch;
let inserts = 0, sends = [], insertError = null, result = { ok: true, sent: 13, notificationsInserted: 58 };
globalThis.__assignmentFailure = false;
let session = { access_token: 'fixture-token' };
globalThis.__announcementDb = {
  auth: { getSession: async () => ({data:{session}}), getUser: async () => ({data:{user:{id:'trainer'}}}) },
  from: table => ({ delete:()=>({eq:async()=>({error:null})}), insert: rows => ({ select: () => {
    assert.equal(table, 'events'); inserts++;
    const response={data: insertError ? null : (Array.isArray(rows)?rows:[rows]).map((row,i)=>({...row,id:`saved-${i}`})), error:insertError};
    return {then:resolve=>Promise.resolve(response).then(resolve),maybeSingle:async()=>({...response,data:response.data?.[0]??null})};
  } }) }),
};
globalThis.fetch = async (url, opts) => {
  sends.push({url, ...opts, body:JSON.parse(opts.body)});
  if (result instanceof Error) throw result;
  return {ok:result.httpOk !== false,json:async()=>result};
};
const mocks = {
  supabaseClient: 'export const supabase=globalThis.__announcementDb;',
  seasonTransition: 'export const assertTeamSeasonWritable=async()=>({ok:true});',
  venues: 'export const resolveClubIdForTeamSeason=async()=>({clubId:null}); export const locationTextFromVenue=()=>"";',
  VenuePicker: 'export const VenuePicker=()=>null;',
  TrainingFacilityFields: 'export const TrainingFacilityFields=()=>null;',
  eventFieldAssignments: 'export const findAssignmentConflicts=async()=>({data:[],error:null}); export const upsertEventFieldAssignment=async()=>globalThis.__assignmentFailure?{error:"conflict"}:{data:{id:"assignment"}};export const defaultEventEndsAt=()=>"";',
  teamSeasonTrainingVenues: 'export const assertVenuePurposeAllowed=async()=>({ok:true});export const listAllowedVenueRowsForPurpose=async()=>({data:[]});',
  opponentCatalog: 'export const ensureOpponentCatalogEntry=async()=>{};',
  teamLogos: 'export const isPlaceholderLogoUrl=()=>false;',
  Button: 'import React from "react"; export const Button=({children,...p})=>React.createElement("button",p,children);',
  Modal: 'import React from "react"; export const Modal=({children,footer})=>React.createElement("div",null,children,footer);',
  events: 'import React from "react"; const Field=({onChange,...p})=>React.createElement("input",{...p,onChange:e=>onChange(e.target.value)});export const EventDateField=Field,EventTimeField=Field;export const OpponentLogoField=()=>null;export const EVENT_FORM_INPUT_CLASS="",EVENT_FORM_LABEL_CLASS="";',
};
const compiled=await build({stdin:{contents:`export {CreateEventModal} from './src/app/components/CreateEventModal';export {announceNewEvents,newEventsAnnouncement} from './src/lib/notifications/newEvents';export {createFacilityOccupancy} from './src/lib/createFacilityOccupancy';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(api){
  api.onResolve({filter:/.*/},args=>{
    if(args.path === 'react') return {path:'react',external:true};
    const key=args.path.split('/').at(-1);
    if(mocks[key])return {path:key,namespace:'fixture'};
  });
  api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
}}]});
const mod={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const {CreateEventModal,announceNewEvents,newEventsAnnouncement,createFacilityOccupancy}=mod.exports;
const future=[0,7,21,28,35].map((d,i)=>({id:`event-${i}`,starts_at:new Date(Date.UTC(2099,10,13+d,16)).toISOString(),notes:'U12 Hallentraining · Ende: 18:15 Uhr',kind:'training',status:'upcoming'}));
let root;
const settle=fn=>act(async()=>{await fn();await new Promise(resolve=>setImmediate(resolve));});
try {
  const copy=newEventsAnnouncement(future);
  assert.match(copy.title,/5 neue Termine/);
  assert.match(copy.body,/17:00 Uhr/,'Use Vienna local time in winter');
  assert.ok(!copy.body.includes('Ende:'),'Internal notes are not announced');
  assert.equal(copy.url,'/app/termine');
  assert.equal(newEventsAnnouncement([{...future[0],starts_at:'2000-01-01',status:'upcoming'}]),null);
  assert.equal(newEventsAnnouncement([{...future[0],status:'canceled'}]),null);
  for(const kind of ['training','tournament','match','event']) {
    const single={...future[0],kind,notes:null,opponent:kind==='match'?'Loosdorf':null};
    assert.equal(await announceNewEvents('team',[single]),null);
    assert.equal(sends.at(-1).body.url,`/app/events/${single.id}`);
  }
  sends=[];
  assert.equal(await announceNewEvents('team',future),null);
  assert.equal(sends.length,1,'A recurring batch creates exactly one request');
  assert.equal(sends[0].body.recipient_group,'all');
  assert.equal(sends[0].body.team_season_id,'team');
  for(const failure of [{ok:false},{httpOk:false},{ok:true,failed:1},{ok:true,notificationsInsertError:'db'},new Error('network')]) {
    result=failure;
    assert.match(await announceNewEvents('team',future),/Termin gespeichert/);
  }
  session=null;const previous=sends.length;
  assert.ok(await announceNewEvents('team',future));
  assert.equal(sends.length,previous,'Missing session must not send an unauthenticated request');
  session={access_token:'fixture-token'};

  // Exercise the actual create form: insert failure sends nothing; push failure
  // leaves the saved form locked so another submit cannot create duplicates.
  let closed=0;
  const render=()=>settle(()=>{root=create(React.createElement(CreateEventModal,{isOpen:true,teamSeasonId:'team',eventType:'training',onSuccess:async()=>{},onClose:()=>closed++}));});
  const change=async(id,value)=>settle(()=>root.root.findAllByType('input').find(n=>n.props.id===id).props.onChange({target:{value}}));
  await render();
  await change('create-event-title','U12 Hallentraining');
  await change('create-event-start_date','2099-11-13');
  await change('create-event-start_time','17:00');
  await settle(()=>root.root.findAllByType('input').filter(n=>n.props.type==='checkbox').at(-1).props.onChange({target:{checked:true}}));
  const submit=()=>root.root.findByType('form').props.onSubmit({preventDefault(){}});
  insertError={message:'insert rejected'};sends=[];
  await settle(submit);assert.equal(sends.length,0);
  insertError=null;result=new Error('network');
  await settle(submit);assert.equal(sends.length,1);assert.equal(closed,0);
  assert.ok(root.root.findAllByProps({role:'alert'}).some(n=>n.children.join('').includes('Termin gespeichert')));
  const savedInsertCount=inserts;
  await settle(submit);assert.equal(inserts,savedInsertCount,'Saving again after notification failure cannot duplicate events');
  assert.equal(root.root.findAllByType('button').find(n=>n.props.type==='submit').props.disabled,true);
  await settle(()=>root.unmount());root=null;
  await render();result={ok:true,sent:1};sends=[];
  await change('create-event-title','U12 Hallentraining');
  await change('create-event-start_date','2099-11-13');
  await change('create-event-start_time','17:00');
  await settle(()=>root.root.findAllByType('input').filter(n=>n.props.type==='checkbox').at(-1).props.onChange({target:{checked:true}}));
  await settle(()=>root.root.findByProps({id:'create-event-recurrence'}).props.onChange({target:{value:'weekly'}}));
  await change('create-event-until','2099-12-11');
  await settle(submit);
  assert.equal(sends.length,1);assert.match(sends[0].body.title,/5 neue Termine/);assert.equal(closed,1);
  const occupancy={clubId:'club',teamSeasonId:'team',kind:'training',title:'Hallentraining',startsAtIso:future[0].starts_at,endsAtIso:new Date(Date.parse(future[0].starts_at)+3600000).toISOString(),venue:{id:'venue',name:'Halle'},fieldId:'field',zoneId:null,createdByUserId:'trainer'};
  sends=[];globalThis.__assignmentFailure=true;
  const rolledBack=await createFacilityOccupancy(occupancy);
  assert.equal(rolledBack.rolledBack,true);assert.equal(sends.length,0,'Rolled-back occupancy cannot announce a nonexistent event');
  globalThis.__assignmentFailure=false;
  assert.equal((await createFacilityOccupancy(occupancy)).ok,true);assert.equal(sends.length,1,'App/Manager occupancy announces only after assignment succeeds');
  result=new Error('network');
  const persisted=await createFacilityOccupancy(occupancy);
  assert.equal(persisted.ok,true);assert.ok(persisted.notificationWarning,'Push failure keeps the saved occupancy and reports a warning');
  console.log('PASS: actual single/recurring form and App/Manager occupancy, one push per batch, rollback exclusion, Vienna time, all kinds, auth/HTTP/inbox/partial/network failures and duplicate-insert prevention.');
} finally {
  if(root)await settle(()=>root.unmount());
  globalThis.fetch=originalFetch;delete globalThis.__announcementDb;delete globalThis.__assignmentFailure;
}
