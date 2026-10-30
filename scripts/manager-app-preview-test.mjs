import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/manager/preview/previewSession.ts'],bundle:true,format:'cjs',platform:'node',write:false});
const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports);
const {previewSession,previewRequestAllowed,createPreviewFetch}=mod.exports;
const season={id:'draft-season',status:'draft',team:{id:'new-team',name:'New Team'},season:{id:'s',name:'2026/27'}};
const a=previewSession('admin-a',season);
assert.equal(a.role,'fan');assert.equal(a.backendRole,'');assert.equal(a.effectiveRole,'fan');
assert.equal(a.selectedTeamSeasonId,season.id);assert.equal(a.viewTeamSeasonId,season.id);
assert.deepEqual(a.filteredTeamSeasonIds,[season.id]);assert.equal(a.canAccess('roles_admin'),false);
a.setSelectedTeamSeasonId('other');a.setViewTeamSeasonId('other');a.setTeamViewFilter('all');a.setRole('trainer');await a.signOut();
assert.equal(a.selectedTeamSeasonId,season.id);assert.equal(a.role,'fan');assert.equal(a.teamViewFilter,null);
assert.equal(season.status,'draft','preview never activates or publishes a season');
for (const method of ['POST','PATCH','PUT','DELETE']) {
 assert.equal(previewRequestAllowed('https://project.supabase.co/rest/v1/players',method),false);
 assert.equal(previewRequestAllowed('https://project.supabase.co/storage/v1/object/photos/x',method),false);
 assert.equal(previewRequestAllowed('https://project.supabase.co/rest/v1/rpc/admin_update_club',method),false);
}
assert.equal(previewRequestAllowed('https://project.supabase.co/rest/v1/team_seasons','GET'),true);
assert.equal(previewRequestAllowed('https://project.supabase.co/rest/v1/rpc/admin_get_club','POST'),true);
assert.equal(previewRequestAllowed('https://project.supabase.co/auth/v1/token','POST'),true);
assert.equal(previewRequestAllowed('https://project.supabase.co/auth/v1/logout','POST'),false);
console.log('PASS: preview uses an isolated fan scope, cannot switch work team, activate drafts, sign out, mutate data or call unreviewed RPCs.');

let sent=0;
const guarded=createPreviewFetch(async()=>{sent++;return new Response('{}',{status:200});});
assert.equal((await guarded('https://project.supabase.co/rest/v1/players',{method:'POST',body:'{}'})).status,403);
assert.equal((await guarded(new Request('https://project.supabase.co/rest/v1/players',{method:'DELETE'}))).status,403);
assert.equal(sent,0,'blocked mutations never reach the server');
assert.equal((await guarded('https://project.supabase.co/rest/v1/team_seasons')).status,200);
assert.equal(sent,1);
console.log('PASS: actual guarded fetch blocks writes before network dispatch while permitting data reads.');
