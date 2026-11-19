import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));const React=require('react');const {create,act}=require('react-test-renderer');const {build}=require('esbuild');
const result=await build({stdin:{contents:`export {useProfile} from './src/auth/useProfile'; export {marketAccountIdentity} from './src/features/club/marketAccountIdentity';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'profile-db',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const supabase=globalThis.profileDb;`}));}}]});
let selected='';globalThis.window=globalThis;
globalThis.profileDb={from(table){assert.equal(table,'profiles');return{select(columns){selected=columns;return{eq(key,id){assert.equal(key,'id');return{async maybeSingle(){if(columns.split(',').map(s=>s.trim()).includes('full_name'))return {data:null,error:{code:'42703',message:'column profiles.full_name does not exist'}};return {data:{id,first_name:'Johannes',last_name:'Baumann',display_name:null},error:null};}};}};}};}};
const Module=require('node:module');const mod=new Module(resolve('profile-test.cjs'));mod.paths=Module._nodeModulePaths(process.cwd());mod._compile(result.outputFiles[0].text,mod.id);
const {useProfile,marketAccountIdentity}=mod.exports;let actual;
function Probe(){const {profile,error,loading}=useProfile('user');actual={profile,error,loading,identity:marketAccountIdentity(profile,{})};return null;}
let app;await act(async()=>{app=create(React.createElement(Probe));});
assert.equal(actual.error,null);assert.equal(actual.loading,false);assert.equal(actual.profile.full_name,'Johannes Baumann');assert.deepEqual(actual.identity,{name:'Johannes Baumann',initials:'JB'});assert.equal(selected,'id, first_name, last_name, display_name');await act(async()=>app.unmount());
console.log('PASS existing profile schema loads full name and JB without auth name metadata');
