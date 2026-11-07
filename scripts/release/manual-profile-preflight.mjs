// Schema-only LIVE metadata is supplied externally; never copy business rows.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const schema=JSON.parse(fs.readFileSync(process.env.LIVE_SCHEMA_SNAPSHOT,'utf8'));
const q=v=>'"'+v.replaceAll('"','""')+'"';const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const sql=(s,a=[])=>db.query(s,a);
const auth=async(user,role='authenticated')=>{await db.exec('reset role');await sql("select set_config('request.uid',$1,false)",[user??'']);await db.exec('set role '+role);};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create table public.profiles(id uuid primary key,is_admin boolean);create table public.user_roles(user_id uuid,role text);set check_function_bodies=off;`);
 for(const e of schema.enums)await db.exec(`create type ${q(e.schema_name)}.${q(e.name)} as enum (${e.values.map(v=>"'"+v.replaceAll("'","''")+"'").join(',')})`);
 const tables=Map.groupBy(schema.columns,c=>c.table_name);
 for(const [name,cols] of tables)await db.exec(`create table public.${q(name)} (${cols.map(c=>q(c.column_name)+' '+c.data_type+(c.not_null?' not null':'')+(c.default_expr&&!c.attgenerated?' default '+c.default_expr:'')).join(',')})`);
 for(const [table,column] of [['clubs','id'],['teams','id'],['seasons','id'],['team_seasons','id'],['team_photos','team_season_id'],['manager_setup_progress','team_season_id']])await db.exec(`alter table public.${q(table)} add primary key(${q(column)})`);
 for(const f of schema.functions)await db.exec(f.definition);
 for(const f of schema.functions)await db.exec(`revoke all on function public.${q(f.proname)}(${f.arguments}) from public`);
 for(const g of schema.routine_grants)await db.exec(`grant execute on function public.${q(g.proname)}(${g.arguments}) to ${g.grantee?q(g.grantee):'public'}`);
 await db.exec('grant usage on schema public,auth to anon,authenticated;grant select on memberships to authenticated;');
 for(const g of schema.grants)if(['anon','authenticated','service_role'].includes(g.grantee))await db.exec(`grant ${g.privilege_type} on public.${q(g.table_name)} to ${q(g.grantee)}`);
 for(const table of ['clubs','team_seasons','team_photos','manager_setup_progress'])await db.exec(`alter table public.${q(table)} enable row level security`);
 // Effective LIVE policies for these probes: team_seasons SELECT true subsumes
 // the other SELECT policies; no authenticated INSERTs into team_seasons are used.
 for(const p of schema.policies){
  if(p.tablename==='team_seasons'&&!['team_seasons_select_authenticated','team_seasons_update_staff_for_team'].includes(p.policyname))continue;
  await db.exec(`create policy ${q(p.policyname)} on public.${q(p.tablename)} for ${p.cmd} to ${p.roles.map(q).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''}`);
 }
 await db.exec('set check_function_bodies=on;');
 await sql('insert into auth.users values ($1),($2)',[id(1),id(2)]);await sql("insert into user_roles values ($1,'admin'),($2,'trainer')",[id(1),id(2)]);
 await sql("insert into clubs(id,name,logo_url,primary_color,secondary_color,accent_color) values ($1,'Synthetic A','https://example.invalid/a.png','#112233','#ffffff','#cc2233'),($2,'Synthetic B','https://example.invalid/b.png','#112233','#ffffff','#cc2233')",[id(10),id(11)]);
 await sql("insert into clubs(id,name) values ('f89c97bb-1408-438d-9f93-efec64f51f88','Synthetic seed regression sentinel')");
 await sql("insert into seasons(id,name) values ($1,'2026/27')",[id(20)]);
 await sql("insert into teams(id,name,club_id,calendar_slug) values ($1,'Synthetic team A',$3,'test-a'),($2,'Synthetic team B',$4,'test-b')",[id(30),id(31),id(10),id(11)]);
 await sql("insert into team_seasons(id,team_id,season_id,age_group) values ($1,$4,$6,'U12'),($2,$4,$6,'U13'),($3,$5,$6,'U12')",[id(40),id(41),id(42),id(30),id(31),id(20)]);
 await sql("insert into manager_setup_progress(team_season_id,checks,updated_at,updated_by) values ($1,'{\"club\":\"reviewed\"}','2026-01-01',$4),($2,'{\"club\":\"open\"}','2026-02-01',$4),($3,'{\"club\":\"reviewed\"}','2026-02-01',$4)",[id(40),id(41),id(42),id(1)]);
 await sql("insert into team_photos(team_season_id,photo_url) values ($1,'https://example.invalid/team.png')",[id(40)]);
 await auth(id(1));assert.equal((await sql('select id from clubs')).rows.length,0);await db.exec('reset role');
 const files=execFileSync('git',['diff','--name-only','origin/main','--','supabase/migrations'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.sql'));
 const added=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('_live_club_profile_admin_access.sql'));
 if(!files.includes('supabase/migrations/'+added))files.push('supabase/migrations/'+added);
 const report=[];
 for(const path of files.sort()){await db.exec(fs.readFileSync(path,'utf8'));report.push({path,status:'passed'});}
 // Backfill keeps latest explicit open; preserves reviewed on a different club.
 assert.equal((await sql('select club_id from manager_club_setup_progress')).rows.length,1);
 assert.equal((await sql('select club_id from manager_club_setup_progress')).rows[0].club_id,id(11));
 assert.deepEqual((await sql('select player_photo_template from clubs')).rows.map(r=>r.player_photo_template),['wide','wide','wide']);
 await auth(id(1));assert.equal((await sql('select id from clubs')).rows.length,3);
 const snap=async(team)=>(await sql('select admin_team_setup_snapshot($1) as s',[team])).rows[0].s;
 const check=async(team,step,value)=>sql('select admin_save_setup_check($1,$2,$3)',[team,step,value]);
 assert.equal((await snap(id(40))).checks.club,'open');assert.equal((await snap(id(42))).checks.club,'reviewed');
 await check(id(40),'club','reviewed');assert.equal((await snap(id(41))).checks.club,'reviewed');
 await sql("update clubs set primary_color='#445566' where id=$1",[id(10)]);assert.equal((await snap(id(40))).checks.club,'open');
 await assert.rejects(check(id(40),'club','unneeded'),/Pflichtschritt/);
 await assert.rejects(check(id(40),'bogus','reviewed'),/Ungültiger Schritt/);
 await check(id(40),'team','reviewed');assert.equal((await snap(id(40))).checks.team,'reviewed');
 await sql("select admin_link_oefb_team_source($1,$2,$3)",['https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2026-27/U12/Kader/',id(40),id(10)]);
 const table=(url,team=id(40))=>sql('select admin_set_team_season_club_table($1,$2,$3)',[team,url,'Synthetic A']);
 await table('https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2026-27/U12/Tabellen/');
 assert.match((await sql('select oefb_table_url from team_seasons where id=$1',[id(40)])).rows[0].oefb_table_url,/Tabellen/);
 await assert.rejects(table('https://evil.test/'),/Ungültige/);
 await assert.rejects(table('https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2025-26/U12/Tabellen/'),/anderen Saison/);
 await assert.rejects(table('https://vereine.oefb.at/Other/Mannschaften/Saison-2026-27/U12/Tabellen/'),/eindeutig/);
 await sql("update team_seasons set oefb_table_competition_id='existing' where id=$1",[id(40)]);
 await assert.rejects(table('https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2026-27/U12/Tabellen/'),/bereits zugeordnet/);
 await sql('select admin_save_club_photo_template($1,$2,$3)',[id(10),'square','wide']);
 await assert.rejects(sql('select admin_save_club_photo_template($1,$2,$3)',[id(10),'wide','wide']),/inzwischen|Vorlage geändert/);
 await assert.rejects(sql('select admin_save_club_photo_template($1,$2,$3)',[id(10),'other','square']),/Ungültige/);
 const element={visible:true,x:50,y:50,size:10,color:'#ffffff',opacity:100,align:'center'};
 const design={name:element,number:element,logo:element,team:element};
 const validDesign=async d=>(await sql('select valid_club_profile_design($1::jsonb) as ok',[JSON.stringify(d)])).rows[0].ok;
 const layout={background:'black',source:'original',zoom:100,x:50,y:50,nameX:28,nameY:85,numberX:88,numberY:8};
 const validLayout=async l=>(await sql('select valid_player_photo_layout($1::jsonb) as ok',[JSON.stringify(l)])).rows[0].ok;
 assert.equal(await validDesign(design),true);assert.equal(await validLayout(layout),true);
 const override={...design,team:{...element,showName:false,showSeason:true},name:{...element,x:14}};
 assert.equal(await validDesign(override),true);assert.equal(await validLayout({...layout,profileDesign:override}),true);
 for(const bad of [{...design,team:{...element,showName:'false'}},{...design,team:{...element,showSeason:null}},{...design,team:{...element,unknown:true}}]){assert.equal(await validDesign(bad),false);assert.equal(await validLayout({...layout,profileDesign:bad}),false);}
 assert.equal(await validLayout({...layout,profileDesign:null}),false);
 assert.equal(await validLayout({...layout,profileDesign:{}}),false);
 await db.exec('create temporary table layout_probe(v jsonb check(public.valid_player_photo_layout(v)))');
 await sql('insert into layout_probe values($1::jsonb)',[JSON.stringify({...layout,profileDesign:override})]);
 await assert.rejects(sql('insert into layout_probe values($1::jsonb)',[JSON.stringify({...layout,profileDesign:{}})]),/check constraint/);
 await db.exec('drop table layout_probe');
 const save=(d,expected=null)=>sql('select admin_save_club_profile_design($1,$2,$3,$4::jsonb,$5::jsonb)',[id(10),'square','square',d===null?null:JSON.stringify(d),expected===null?null:JSON.stringify(expected)]);
 await save(design);await assert.rejects(save(design),/inzwischen/);
 for(const bad of [{...design,name:{...element,x:101}},{...design,logo:{...element,color:'url(evil)'}},{...design,team:{...element,align:'bogus'}},{...design,name:{x:5}},{...design,unknown:element}])await assert.rejects(save(bad,design),/Ungültige Gestaltung/);
 await save(null,design);
 await sql("update clubs set status='archived' where id=$1",[id(10)]);
 await assert.rejects(sql('select admin_save_club_photo_template($1,$2,$3)',[id(10),'wide','square']),/nicht aktiv/);
 await assert.rejects(table('https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2026-27/U12/Tabellen/'),/Aktive Mannschaftssaison/);
 await sql("update clubs set status='active' where id=$1",[id(10)]);
 await sql('update team_photos set photo_zoom=150,photo_position_x=20,photo_brightness=90 where team_season_id=$1',[id(40)]);
 await assert.rejects(sql('update team_photos set photo_zoom=500 where team_season_id=$1',[id(40)]),/check constraint/);
 // Global admin scope is required, not merely authentication or trainer status.
 await auth(id(2));assert.equal((await sql('select id from clubs')).rows.length,0);
 for(const command of [()=>snap(id(40)),()=>check(id(40),'club','reviewed'),()=>table('https://vereine.oefb.at/Synthetic/Mannschaften/Saison-2026-27/U12/Tabellen/'),()=>save(design)])await assert.rejects(command(),/Forbidden|Plattformadmin/);
 assert.equal((await sql('select * from manager_club_setup_progress')).rows.length,0);
 const changed=await sql("update clubs set player_photo_template='wide' where id=$1 returning id",[id(10)]);assert.equal(changed.rows.length,0);
 await auth(null,'anon');await assert.rejects(save(design),/permission denied/);await assert.rejects(snap(id(40)),/permission denied/);
 console.log('PASS: LIVE-derived types/helpers/grants and effective RLS; pre-fix admin denial reproduced; admin-only fix, table source guards, shared review/backfill/reset, stale/invalid photo design, nonadmin and anon denial.');
 fs.writeFileSync('/tmp/manual-profile-results.json',JSON.stringify({migrations:report,checks:'passed',limitations:'Synthetic rows; only relevant LIVE table columns/defaults, effective tested policies, helper definitions and grants reconstructed. Original foreign keys, triggers and unrelated SELECT/INSERT policies are not fully recreated.'},null,2));
}catch(e){console.error(JSON.stringify({message:e.message,where:e.where,query:e.query,code:e.code}));process.exitCode=1;}finally{await db.close();}
