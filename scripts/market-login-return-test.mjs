import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export {resolvePostAuthDestination} from './src/lib/postAuthDestination';export {isSafeAuthRedirectPath} from './src/lib/authRedirect';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'dependencies',setup(b){
b.onResolve({filter:/parentLinkInvites$/},()=>({path:'invites',namespace:'mock'}));
b.onResolve({filter:/introFlowSession$/},()=>({path:'intro',namespace:'mock'}));
b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path==='intro'?"export const INTRO_SPLASH_PATH='/intro/splash';export const clearIntroFlowCompleted=()=>{};":"export const resolvePendingParentInvitePath=()=>globalThis.invite||null;export const hasOpenParentEmailInviteForMe=async()=>false;export const markPendingParentEmailInvite=()=>{};export const isAppIntroEntryPath=p=>p.startsWith('/intro');"}));
}}]});
const m={exports:{}};new Function('module','exports',r.outputFiles[0].text)(m,m.exports);
const {resolvePostAuthDestination:resolve,isSafeAuthRedirectPath:safe}=m.exports;
for (const prefix of ['/marktplatz','/vereinsmarkt']) {
globalThis.invite=null;
const market=prefix+'/9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
for(const suffix of ['?view=start','?view=member&mode=mine','?view=member&thread=keep','?listing=keep','?view=member&invite='+ 'a'.repeat(64)]){
 const target=market+suffix;assert.equal(safe(target),true);
 assert.deepEqual(await resolve({next:target,consciousLogin:true}),{path:target,kind:'deep_link',hardReplace:false});
}
assert.equal((await resolve({from:market+'?view=saved',consciousLogin:true})).kind,'deep_link');
for(const bad of ['https://evil.test'+market,'//evil.test'+market,market+'/../../app',market+'/anmelden','/marktplatz/bad'])assert.equal(safe(bad),false);
assert.equal((await resolve({consciousLogin:true})).kind,'branded_entry');
assert.equal((await resolve({next:'/manager',consciousLogin:true})).path,'/manager');
globalThis.invite='/app/parent-invite';assert.equal((await resolve({next:market,consciousLogin:true})).kind,'deep_link');assert.equal((await resolve({next:market,consciousLogin:true,parentInviteFlowHint:true})).kind,'parent_invite');
}
console.log('PASS: market login retains start, listing, own listings and chat; external/traversal rejected; app splash and invite precedence preserved.');
