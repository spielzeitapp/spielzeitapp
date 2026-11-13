-- Synthetic match events only; caller must wrap in BEGIN / ROLLBACK.
create temporary table own_goal_fixture(staff uuid, outsider uuid, season uuid, match uuid);
grant select on own_goal_fixture to authenticated;
do $$declare u uuid:=gen_random_uuid();o uuid:=gen_random_uuid();s uuid:=gen_random_uuid();m uuid:=gen_random_uuid();begin
 insert into auth.users(id,email) values(u,u::text||'@own-goal-test.invalid'),(o,o::text||'@own-goal-test.invalid');
 insert into public.team_seasons(id,status) values(s,'active');
 insert into public.memberships(user_id,team_season_id,role) values(u,s,'trainer');
 insert into public.matches(id,team_season_id,opponent,status) values(m,s,'Synthetic own goal','live');
 insert into own_goal_fixture values(u,o,s,m);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select staff::text from own_goal_fixture),true);
do $$declare f record;e uuid;begin
 select * into f from own_goal_fixture;
 insert into public.match_events(match_id,type,minute,player_id,payload) values(f.match,'goal',120,null,'{"own_goal":true}') returning id into e;
 insert into public.match_events(match_id,type,minute,player_id,payload) values(f.match,'goal_away',180,null,'{"own_goal":true}');
 if (select count(*) from public.match_events where match_id=f.match and payload->>'own_goal'='true' and player_id is null)<>2 then raise exception 'own goal persistence failed';end if;
 update public.match_events set payload='{"own_goal":false}' where id=e;
 if not found then raise exception 'correction denied';end if;
 update public.match_events set payload='{"own_goal":true}' where id=e;
end $$;
select set_config('request.jwt.claim.sub',(select outsider::text from own_goal_fixture),true);
do $$declare f record;begin select * into f from own_goal_fixture;
 begin insert into public.match_events(match_id,type,minute,payload) values(f.match,'goal',1,'{"own_goal":true}');raise exception 'Expected denial';exception when insufficient_privilege then null;end;
 update public.match_events set payload='{"own_goal":false}' where match_id=f.match;
 if found then raise exception 'outsider edited own goal';end if;
end $$;
reset role;
select 'PASS own goals: staff insert both sides/read/correct; no player credit; outsider writes denied' as result;
