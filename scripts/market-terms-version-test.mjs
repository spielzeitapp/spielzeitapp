import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.EXCHANGE_PGLITE_PATH||'@electric-sql/pglite'),db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create table public.exchange_threads(requester_id uuid,requester_team_label text);
 create table public.exchange_listings(owner_id uuid,team_label text);
 create table private.market_terms_acceptances(user_id uuid references auth.users(id),terms_version text not null check(terms_version='2026-11-17'),accepted_at timestamptz not null default now(),primary key(user_id,terms_version));alter table private.market_terms_acceptances enable row level security;revoke all on private.market_terms_acceptances from public,anon,authenticated;`);
 const user='10000000-0000-0000-0000-000000000001';await db.query("insert into auth.users values($1,'{}')",[user]);await db.query("insert into private.market_terms_acceptances(user_id,terms_version) values($1,'2026-11-17')",[user]);
 const before=(await db.query('select accepted_at from private.market_terms_acceptances')).rows[0].accepted_at;
 await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_market_terms_private_transactions_version.sql')),'utf8'));
 await db.exec('create trigger market_registration_choices after insert or update of raw_user_meta_data on auth.users for each row execute function private.market_registration_choices()');
 await db.query("insert into public.exchange_threads values($1,'U12')",[user]);await db.query("insert into public.exchange_listings values($1,'U12')",[user]);
 for(const version of ['2026-11-18','2026-11-18','invalid'])await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[JSON.stringify({auth_entry:'vereinsmarkt',market_terms_version:version,market_show_team:false}),user]);
 const rows=(await db.query('select terms_version,accepted_at from private.market_terms_acceptances order by terms_version')).rows;assert.equal(rows.length,2);assert.equal(rows[0].accepted_at.getTime(),before.getTime());assert.equal(rows[1].terms_version,'2026-11-18');
 assert.equal((await db.query('select requester_team_label from public.exchange_threads')).rows[0].requester_team_label,'');assert.equal((await db.query('select team_label from public.exchange_listings')).rows[0].team_label,'');
 assert.equal((await db.query("select has_table_privilege('authenticated','private.market_terms_acceptances','select') allowed")).rows[0].allowed,false);
 console.log('PASS: old receipt preserved, new version recorded once, invalid version ignored, withdrawal retained, receipts private');
}finally{await db.close()}
