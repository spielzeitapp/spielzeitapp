import assert from 'node:assert/strict';
const url='https://acbaecjzoabafbsjrzvr.supabase.co';
const key=process.env.STAGING_SUPABASE_ANON_KEY;
if(!key)throw Error('STAGING_SUPABASE_ANON_KEY required (publishable TEST anon key)');
const selects=[
 ['team_seasons','id,team_id,season_id,status,display_name,age_group,teams:teams(id,name,club_id,age_group,clubs(name,logo_url)),seasons(id,name)'],
 ['teams','id,name,club_id,clubs(name,logo_url)'],
 ['memberships','id,role,team_season_id,team_seasons(id,team:teams(id,name),season:seasons(id,name))'],
];
for(const[table,select]of selects){
 const request=new URL(url+'/rest/v1/'+table);request.searchParams.set('select',select);request.searchParams.set('limit','1');
 const response=await fetch(request,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(25000)});
 const data=await response.json();
 assert.equal(response.status,200,`${table} embedding failed: ${data.code||response.status} ${data.message||''}`);
 assert.ok(Array.isArray(data));
 console.log(`PASS: real TEST PostgREST ${table} legacy nested relationship resolves without PGRST201`);
}
