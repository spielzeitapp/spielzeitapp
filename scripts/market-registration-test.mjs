import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer'),{MemoryRouter}=require('react-router-dom'),Module=require('module');
const events=new EventTarget(),viewport=new EventTarget();
globalThis.window={visualViewport:viewport,addEventListener(){},removeEventListener(){},localStorage:{getItem(){return null;}},location:{origin:'https://test'}};
globalThis.document={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),activeElement:null};
const frames=new Map();let frame=0;
globalThis.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
const flushFrames=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
globalThis.HTMLElement=class {};
const state=globalThis.registrationTest={result:{data:{user:{identities:[]},session:null},error:null},calls:0};
const mocks={
 postAuthDestination:"export const resolvePostAuthDestination=async()=>({path:'/app/home',kind:'deep_link'});",
 AuthProvider:"export const useAuth=()=>({user:null,session:null,loading:false});",
 supabaseClient:"export const supabase={auth:{signUp:async(payload)=>{globalThis.registrationTest.payload=payload;globalThis.registrationTest.calls++;return globalThis.registrationTest.result;}}};",
 TurnstileWidget:"export const isTurnstileConfigured=false;export const TurnstileWidget=()=>null;",
 parentLinkInvites:"export const buildParentInviteAuthQuery=()=>'';export const ensureParentInviteContextFromNext=()=>{};export const extractInviteTokenFromNext=()=>null;export const readStashedParentInviteEmail=()=>null;export const readStashedParentInviteToken=()=>null;export const resolvePendingParentInvitePath=()=>null;export const stashParentInviteEmail=()=>{};export const stashParentInviteToken=()=>{};",
};
const built=await build({entryPoints:['src/pages/RegisterPage.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,loader:{'.css':'empty'},define:{'import.meta.env':'{}'},plugins:[{name:'fixtures',setup(b){for(const name of Object.keys(mocks))b.onResolve({filter:new RegExp(name+'$')},()=>({path:name,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const m=new Module('registration-test');m.paths=require.resolve.paths('react');m._compile(built.outputFiles[0].text,'registration-test');
const club='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a',next=`/vereinsmarkt/${club}?view=member&invite=${'a'.repeat(64)}`;
let app;
const mount=()=>act(async()=>{app=create(React.createElement(MemoryRouter,{initialEntries:[`/vereinsmarkt/${club}/registrieren?context=vereinsmarkt&next=${encodeURIComponent(next)}`],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(m.exports.RegisterPage)));});
const fill=()=>act(async()=>{for(const [id,value] of [['reg-first-name','Anna'],['reg-last-name','Test'],['reg-email','test@example.com'],['reg-password','secret123'],['reg-confirm-password','secret123']])app.root.findByProps({id}).props.onChange({target:{value}});app.root.findByProps({id:'reg-market-terms'}).props.onChange({target:{checked:true}});});
const submit=()=>act(async()=>{await app.root.findByType('form').props.onSubmit({preventDefault(){}});});
await mount();assert.ok(app.root.findAllByType('a').some(a=>a.props.href==='/vereinsmarkt/datenschutz.html'));assert.equal(app.root.findByProps({id:'reg-market-terms'}).props.required,true);assert.equal(app.root.findByProps({id:'reg-market-show-team'}).props.required,undefined);assert.equal(app.root.findByProps({id:'reg-market-terms'}).props.checked,false);assert.equal(app.root.findByProps({id:'reg-market-show-team'}).props.checked,false);await submit();assert.equal(state.calls,0,'terms are required before signup');await fill();await submit();
assert.equal(state.calls,1);assert.equal(app.root.findAllByType('form').length,0);
assert.ok(!JSON.stringify(app.toJSON()).includes('E-Mail bestätigen'),'repeated signup must not claim confirmation delivery');
for(const label of ['Zur Anmeldung','Passwort vergessen']){const link=app.root.findAllByType('a').find(a=>a.children.includes(label));assert.ok(link);assert.equal(new URL(link.props.href,'https://test').searchParams.get('next'),next,'preserve club invitation across recovery');}
await act(async()=>app.root.findAllByType('button').find(b=>b.children.includes('Andere E-Mail-Adresse verwenden')).props.onClick());
assert.equal(app.root.findByProps({id:'reg-password'}).props.value,'');
assert.equal(app.root.findByProps({id:'reg-first-name'}).props.value,'Anna');
// Keyboard opening: reveal the focused field using the page's actual visible bounds.
const page={scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:300})};
const field=new HTMLElement();field.matches=()=>true;field.closest=()=>page;field.getBoundingClientRect=()=>({top:250,bottom:298});document.activeElement=field;
viewport.dispatchEvent(new Event('resize'));flushFrames();assert.equal(page.scrollTop,22);
field.getBoundingClientRect=()=>({top:50,bottom:98});viewport.dispatchEvent(new Event('resize'));flushFrames();assert.equal(page.scrollTop,22,'visible input must not jump');
await act(async()=>app.unmount());document.activeElement=null;
state.result={data:{user:{identities:[{id:'new'}]},session:null},error:null};await mount();await fill();await submit();
assert.ok(JSON.stringify(app.toJSON()).includes('E-Mail für den Vereinsmarkt bestätigen'),'new accounts retain market confirmation flow');
assert.ok(JSON.stringify(app.toJSON()).includes('mehreren Kindern in verschiedenen U-Teams'),'confirmation explains multiple child teams');
assert.equal(state.payload.options.data.auth_entry,'vereinsmarkt','email branding context is sent on signup');assert.equal(state.payload.options.data.market_terms_version,'2026-11-18');assert.equal(state.payload.options.data.market_show_team,false,'sharing is optional and off by default');
assert.ok(app.root.findAllByType('div').some(d=>String(d.props.className).includes('market-auth-confirmation')),'confirmation uses market theme');
await act(async()=>app.unmount());
state.result={data:{user:null,session:null},error:{message:'Email rate limit exceeded'}};await mount();await fill();await submit();
assert.ok(JSON.stringify(app.toJSON()).includes('Zu viele Versuche'));assert.equal(app.root.findAllByType('form').length,1);
await act(async()=>app.unmount());
console.log('PASS: existing account recovery, invitation retained, new signup confirmation, API error, keyboard reveal without focus changes');

state.result={data:{user:{identities:[{id:'opt-in'}]},session:null},error:null};await mount();await fill();await act(async()=>app.root.findByProps({id:'reg-market-show-team'}).props.onChange({target:{checked:true}}));await submit();assert.equal(state.payload.options.data.market_show_team,true);await act(async()=>app.unmount());console.log('PASS: explicit terms, separate privacy link, sharing off by default and saved explicit opt-in');

const contextBuild=await build({entryPoints:['src/features/club/marketAuth.ts'],bundle:true,platform:'node',format:'cjs',write:false});const contextModule={exports:{}};new Function('module','exports',contextBuild.outputFiles[0].text)(contextModule,contextModule.exports);for(const segment of ['registrieren','anmelden','passwort-vergessen'])assert.equal(contextModule.exports.marketAuthContext('',`/vereinsmarkt/${club}/${segment}`).club,club);assert.equal(contextModule.exports.marketAuthContext('','/register'),null);console.log('PASS: bare market auth URLs retain market context without query parameters');
