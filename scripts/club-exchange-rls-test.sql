-- Run ONLY in TEST. All synthetic users, memberships, objects and notifications
-- are rolled back. Real subscriptions and outbound delivery are never used.
begin;
create temp table exchange_test_context as
 select gen_random_uuid() owner_id,gen_random_uuid() requester_id,gen_random_uuid() bystander_id,
 gen_random_uuid() outsider_id,gen_random_uuid() player_id,gen_random_uuid() listing_id,
 gen_random_uuid() thread_id,gen_random_uuid() message_id,
 s.id season_id,t.club_id,
 (select s2.id from public.team_seasons s2 join public.exchange_partner_teams p on p.team_id=s2.team_id
 where p.club_id=t.club_id and s2.status='active' limit 1) partner_season_id
 from public.team_seasons s join public.teams t on t.id=s.team_id
 where s.status='active' and exists(select 1 from public.exchange_partner_teams p where p.club_id=t.club_id) limit 1;
do $$begin if not exists(select 1 from exchange_test_context where partner_season_id is not null) then raise exception 'TEST club/partner fixture missing'; end if; end$$;
grant select on exchange_test_context to authenticated;
insert into auth.users(id,email) select u,u::text||'@exchange-test.invalid' from exchange_test_context c,
 lateral unnest(array[c.owner_id,c.requester_id,c.bystander_id,c.outsider_id,c.player_id]) u;
insert into public.profiles(id,first_name,last_name,email,phone)
 select u,'Testvorname','GeheimNachname',u::text||'@exchange-test.invalid','PRIVATE_PHONE' from exchange_test_context c,
 lateral unnest(array[c.owner_id,c.requester_id,c.bystander_id,c.outsider_id,c.player_id]) u
 on conflict(id) do update set first_name='Testvorname',last_name='GeheimNachname',phone='PRIVATE_PHONE';
insert into public.memberships(user_id,team_season_id,role)
 select owner_id,season_id,'parent'::public.membership_role from exchange_test_context union all
 select requester_id,partner_season_id,'parent'::public.membership_role from exchange_test_context union all
 select bystander_id,season_id,'parent'::public.membership_role from exchange_test_context union all
 select player_id,season_id,'player'::public.membership_role from exchange_test_context;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %',label; end if; end$$;

select set_config('request.jwt.claim.sub',owner_id::text,true) from exchange_test_context;
set local role authenticated;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.exchange_listings','TRUNCATE'),'no truncate grant');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.exchange_listings','club_id','UPDATE'),'club cannot be reassigned');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.exchange_listings','owner_id','UPDATE'),'owner cannot be reassigned');
select pg_temp.assert_true(not has_table_privilege('anon','public.exchange_listings','SELECT'),'anonymous has no grants');
select pg_temp.assert_true(public.exchange_access(club_id),'member can enter') from exchange_test_context;
insert into public.exchange_listings(id,club_id,title,category,size,condition,offer,status,owner_label)
 select listing_id,club_id,'TEST Pulli','Pulli','140','Gut','Gratis','Entwurf','FORGED NAME' from exchange_test_context;
select pg_temp.assert_true(owner_label='Testvorname','name derived from profile; no contact data')
 from public.exchange_listings where id=(select listing_id from exchange_test_context);
insert into storage.objects(bucket_id,name) select 'exchange-photos',club_id::text||'/'||owner_id::text||'/'||listing_id::text||'/test.jpg' from exchange_test_context;
update public.exchange_listings set photo_paths=array[club_id::text||'/'||owner_id::text||'/'||id::text||'/test.jpg'],status='Verfügbar'
 where id=(select listing_id from exchange_test_context) and revision=0;
select pg_temp.assert_true(revision=1,'revision increments') from public.exchange_listings where id=(select listing_id from exchange_test_context);
do $$declare n int;begin
 update public.exchange_listings set size='152' where id=(select listing_id from exchange_test_context) and revision=0;
 get diagnostics n=row_count; perform pg_temp.assert_true(n=0,'stale editor rejected');
 begin update public.exchange_listings set size='' where id=(select listing_id from exchange_test_context); raise exception 'invalid size accepted'; exception when check_violation then null; end;
 begin update public.exchange_listings set photo_paths=array['another-club/fake.jpg'] where id=(select listing_id from exchange_test_context); raise exception 'foreign photo path accepted'; exception when raise_exception then if sqlerrm<>'Ungültiger Fotopfad' then raise; end if; end;
end$$;

reset role;
select set_config('request.jwt.claim.sub',requester_id::text,true) from exchange_test_context;
set local role authenticated;
select pg_temp.assert_true(public.exchange_access(club_id),'partner youth team can enter') from exchange_test_context;
select pg_temp.assert_true(count(*)=1,'cross-team listing visible') from public.exchange_listings where id=(select listing_id from exchange_test_context);
select pg_temp.assert_true(count(*)=1,'private object visible to club member') from storage.objects where bucket_id='exchange-photos' and name like (select club_id::text||'/'||owner_id::text||'/'||listing_id::text||'/%' from exchange_test_context);
do $$declare n int; begin
 update public.exchange_listings set status='Vergeben' where id=(select listing_id from exchange_test_context);
 get diagnostics n=row_count; perform pg_temp.assert_true(n=0,'nonowner update denied');
 begin insert into public.exchange_listings(club_id,owner_id,title,category,size,condition,offer,status)
 select club_id,owner_id,'Forgery','Pulli','140','Gut','Gratis','Entwurf' from exchange_test_context;
 raise exception 'forged owner accepted'; exception when insufficient_privilege then null; end;
end$$;
insert into public.exchange_threads(id,listing_id,requester_id) select thread_id,listing_id,requester_id from exchange_test_context;
do $$begin
 begin insert into public.exchange_threads(listing_id,requester_id) select listing_id,requester_id from exchange_test_context;
 raise exception 'duplicate thread accepted'; exception when unique_violation then null; end;
end$$;
insert into public.exchange_messages(id,thread_id,body) select message_id,thread_id,'PRIVATE_BODY' from exchange_test_context;
do $$begin
 begin insert into public.exchange_messages(thread_id,sender_id,body) select thread_id,owner_id,'forged sender' from exchange_test_context;
 raise exception 'forged sender accepted'; exception when insufficient_privilege then null; end;
end$$;

reset role;
select pg_temp.assert_true(count(*)=1,'exactly one durable push job for message') from public.exchange_push_queue where message_id=(select message_id from exchange_test_context);
select pg_temp.assert_true(recipient_id=c.owner_id and q.sender_id=c.requester_id,'push targets only owner') from public.exchange_push_queue q cross join exchange_test_context c where q.message_id=c.message_id;
select pg_temp.assert_true(q.link='/app/tauschboerse?club='||c.club_id::text||'&thread='||c.thread_id::text,'canonical link preserves club and private thread') from public.exchange_push_queue q cross join exchange_test_context c where q.message_id=c.message_id;
select pg_temp.assert_true(count(*)=1,'in-app notification inserted') from public.notifications n cross join exchange_test_context c where n.user_id=c.owner_id and n.kind='exchange:'||c.thread_id::text;

select set_config('request.jwt.claim.sub',bystander_id::text,true) from exchange_test_context;
set local role authenticated;
select pg_temp.assert_true(count(*)=0,'third club member cannot read thread') from public.exchange_threads where id=(select thread_id from exchange_test_context);
select pg_temp.assert_true(count(*)=0,'third club member cannot read messages') from public.exchange_messages where id=(select message_id from exchange_test_context);
do $$begin
 begin insert into public.exchange_messages(thread_id,body) select thread_id,'intruder' from exchange_test_context;
 raise exception 'third member wrote to chat'; exception when insufficient_privilege then null; end;
end$$;

reset role;
select set_config('request.jwt.claim.sub',outsider_id::text,true) from exchange_test_context;
set local role authenticated;
select pg_temp.assert_true(not public.exchange_access(club_id),'outsider cannot enter') from exchange_test_context;
select pg_temp.assert_true(count(*)=0,'outsider cannot see listing') from public.exchange_listings where id=(select listing_id from exchange_test_context);
select pg_temp.assert_true(count(*)=0,'outsider cannot see object') from storage.objects where bucket_id='exchange-photos' and name like (select club_id::text||'/'||owner_id::text||'/'||listing_id::text||'/%' from exchange_test_context);
reset role;
select set_config('request.jwt.claim.sub',player_id::text,true) from exchange_test_context;
set local role authenticated;
select pg_temp.assert_true(not public.exchange_access(club_id),'player-only account cannot trade') from exchange_test_context;

reset role;
select set_config('request.jwt.claim.sub',owner_id::text,true) from exchange_test_context;
set local role authenticated;
insert into public.exchange_messages(thread_id,body) select thread_id,'Owner reply' from exchange_test_context;
insert into public.exchange_blocks(club_id,blocked_id) select club_id,requester_id from exchange_test_context;
reset role;
select set_config('request.jwt.claim.sub',requester_id::text,true) from exchange_test_context;
set local role authenticated;
do $$begin
 begin insert into public.exchange_messages(thread_id,body) select thread_id,'blocked message' from exchange_test_context;
 raise exception 'blocked user can send'; exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',owner_id::text,true) from exchange_test_context;
set local role authenticated;
delete from public.exchange_blocks where blocked_id=(select requester_id from exchange_test_context);
update public.exchange_listings set status='Reserviert' where id=(select listing_id from exchange_test_context);
delete from public.exchange_listings where id=(select listing_id from exchange_test_context);
select pg_temp.assert_true(count(*)=0,'delete cascades private messages') from public.exchange_messages where thread_id=(select thread_id from exchange_test_context);
delete from storage.objects where bucket_id='exchange-photos' and name like (select club_id::text||'/'||owner_id::text||'/'||listing_id::text||'/%' from exchange_test_context);
reset role;
rollback;
select 'PASS: membership, cross-team access, owner-only changes, photo paths/storage RLS, private chats, sender spoofing, duplicate threads, notification recipients, blocks, stale revision and cleanup; all fixtures rolled back' as result;
