-- Synthetic, transaction-only permission and lifecycle regression tests.
-- Run after the candidate definitions inside BEGIN; ROLLBACK, never on real club data.
create temp table lifecycle_test_context (key text primary key,id uuid);
grant select on lifecycle_test_context to authenticated,anon;
do $$
declare u uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); e uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,'lifecycle-trainer-'||u||'@example.invalid','{}'),(f,'lifecycle-fan-'||f||'@example.invalid','{}');
 insert into public.clubs(id,name,status) values(c,'Synthetic lifecycle regression','active');
 insert into public.teams(id,club_id,name,age_group) values(t,c,'Synthetic KM','KM'),(t2,c,'Foreign KM','KM');
 insert into public.seasons(id,name) values(s,'2024/25');
 insert into public.team_seasons(id,team_id,season_id,status,age_group) values(a,t,s,'active','KM'),(b,t2,s,'active','KM');
 insert into public.memberships(user_id,team_season_id,role) values(u,a,'trainer'),(f,a,'fan');
 insert into public.players(id,team_season_id,first_name,last_name,is_active,status,jersey_number) values(p,a,'Synthetic','Player',true,'active',7);
 insert into public.team_season_players(player_id,team_season_id,status,is_active,jersey_number) values(p,a,'active',true,7);
 insert into public.matches(id,team_season_id,opponent,match_date,status) values(m,a,'Synthetic opponent','2025-05-30T16:00Z','finished');
 insert into public.events(id,team_season_id,kind,type,match_type,opponent,starts_at,status,match_id) values(e,a,'match','game','league','Synthetic opponent','2025-05-30T16:00Z','finished',m);
 insert into public.team_photos(team_season_id,photo_url) values(a,'https://example.invalid/synthetic.png');
 insert into lifecycle_test_context values('trainer',u),('fan',f),('source',a),('foreign',b),('player',p),('event',e),('match',m);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from lifecycle_test_context where key='fan'),true);
do $$begin
 begin perform public.prepare_season_lifecycle((select id from lifecycle_test_context where key='source'));raise exception 'Fan was allowed' using errcode='P0004'; exception when insufficient_privilege then null; end;
 begin perform public.get_season_lifecycle((select id from lifecycle_test_context where key='foreign'));raise exception 'Foreign season leaked' using errcode='P0004'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from lifecycle_test_context where key='trainer'),true);
do $$declare a uuid:=(select id from lifecycle_test_context where key='source'); x jsonb; y jsonb;
begin
 x:=public.prepare_season_lifecycle(a);y:=public.prepare_season_lifecycle(a);
 if x->>'target_id' is distinct from y->>'target_id' or x->>'target_status'<>'draft' or x->>'target_season_name'<>'2025/26' then raise exception 'Draft is not idempotent';end if;
 if (x->>'possible_end')::boolean is distinct from true then raise exception 'Finished spring fixture not recognized';end if;
 begin perform public.prepare_season_lifecycle(a,'2027/28');raise exception 'Skipped season accepted' using errcode='P0004';exception when raise_exception then if sqlerrm='Skipped season accepted' then raise;end if;end;
 begin perform public.finish_season_lifecycle(a,(x->>'target_id')::uuid,x->>'fingerprint',false);raise exception 'Missing approval accepted' using errcode='P0004';exception when raise_exception then if sqlerrm='Missing approval accepted' then raise;end if;end;
 begin perform public.finish_season_lifecycle(a,(x->>'target_id')::uuid,'stale',true);raise exception 'Stale source accepted' using errcode='P0004';exception when serialization_failure then null;end;
 begin perform public.finish_season_lifecycle(a,(x->>'target_id')::uuid,x->>'fingerprint',true,false,array[(select id from lifecycle_test_context where key='fan')]);raise exception 'Foreign roster accepted' using errcode='P0004';exception when raise_exception then if sqlerrm='Foreign roster accepted' then raise;end if;end;
end $$;
reset role;
do $$declare a uuid:=(select id from lifecycle_test_context where key='source'); s uuid;begin
 begin
  insert into public.seasons(name) values('2026/27') returning id into s;
  insert into public.team_seasons(team_id,season_id,status,prepared_from_team_season_id) select team_id,s,'draft',a from public.team_seasons where id=a;
  raise exception 'Concurrent legacy draft accepted' using errcode='P0004';
 exception when unique_violation then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from lifecycle_test_context where key='trainer'),true);
do $$declare a uuid:=(select id from lifecycle_test_context where key='source');x jsonb;y jsonb;begin
 x:=public.resolve_event_team_season(a,'2025-07-05T15:00:00Z');y:=public.resolve_event_team_season(a,null,'2025/26','KM');
 if x->>'team_season_id' is distinct from y->>'team_season_id' or not (x->>'prepared')::boolean then raise exception 'Manual game / import target mismatch';end if;
 begin insert into public.events(team_season_id,kind,type,starts_at,status) values(a,'training','training','2025-07-05T15:00Z','upcoming');raise exception 'Cross-season insert accepted' using errcode='P0004';exception when raise_exception then if sqlstate='P0004' then raise;end if;end;
end $$;
reset role;
do $$declare a uuid:=(select id from lifecycle_test_context where key='source'); x jsonb;begin
 x:=season_lifecycle.snapshot(a);
 if exists(select 1 from public.team_season_players where team_season_id=(x->>'target_id')::uuid) then raise exception 'Roster was copied without confirmation';end if;
 update public.matches set status='live',live_is_running=true where id=(select id from lifecycle_test_context where key='match');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from lifecycle_test_context where key='trainer'),true);
do $$declare a uuid:=(select id from lifecycle_test_context where key='source');x jsonb;begin
 x:=(public.get_season_lifecycle(a)->0);
 begin perform public.finish_season_lifecycle(a,(x->>'target_id')::uuid,x->>'fingerprint',true);raise exception 'Live match archived' using errcode='P0004';exception when raise_exception then if sqlerrm='Live match archived' then raise;end if;end;
end $$;
reset role;
update public.matches set status='finished',live_is_running=false where id=(select id from lifecycle_test_context where key='match');
update public.team_season_players set status='paused',is_active=false where player_id=(select id from lifecycle_test_context where key='player');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from lifecycle_test_context where key='trainer'),true);
do $$declare a uuid:=(select id from lifecycle_test_context where key='source');x jsonb;target uuid;begin
 x:=(public.get_season_lifecycle(a)->0);target:=(x->>'target_id')::uuid;
 x:=public.finish_season_lifecycle(a,target,x->>'fingerprint',true,false,null,'KM');
 if x->>'status'<>'archived' or x->>'target_status'<>'draft' then raise exception 'Archive + prepare failed';end if;
 x:=public.finish_season_lifecycle(a,target,x->>'fingerprint',true,true);
 if x->>'target_status'<>'active' then raise exception 'Activation failed';end if;
 perform public.finish_season_lifecycle(a,target,'old retry',true,true);
 begin insert into public.events(team_season_id,kind,type,starts_at,status) values(a,'training','training','2025-06-01','upcoming');raise exception 'Archived write accepted' using errcode='P0004';exception when others then if sqlstate='P0004' then raise;end if;end;
end $$;
reset role;
do $$declare a uuid:=(select id from lifecycle_test_context where key='source'); x jsonb;target uuid;begin
 x:=season_lifecycle.snapshot(a);target:=(x->>'target_id')::uuid;
 if (select count(*) from public.team_season_players where team_season_id=target)<>1 or (select count(*) from public.team_season_players where team_season_id=a)<>1 then raise exception 'Roster duplicate or source lost';end if;
 if (select count(*) from public.matches where team_season_id=a)<>1 or exists(select 1 from public.matches where team_season_id=target) then raise exception 'Historical statistics moved';end if;
 if not exists(select 1 from public.team_season_players where team_season_id=target and status='paused' and not is_active) then raise exception 'Paused player was dropped or activated';end if;
 if not exists(select 1 from public.team_photos where team_season_id=target) then raise exception 'Photo missing';end if;
 if has_schema_privilege('authenticated','season_lifecycle','USAGE') or has_function_privilege('authenticated','season_lifecycle.tick()','EXECUTE') then raise exception 'Private worker exposed';end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform public.get_season_lifecycle(null);raise exception 'Anonymous list allowed' using errcode='P0004';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: staff/fan/anon isolation, idempotent draft, approval, stale state, live guard, archive/activate, roster identity, source history, private worker ACL' as season_lifecycle_tests;
