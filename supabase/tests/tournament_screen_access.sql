begin;
create temp table screen_test_ids as select (select id from public.events where kind='tournament' and team_season_id is not null limit 1) as event_id,
 gen_random_uuid() as admin_id,gen_random_uuid() as trainer_id,gen_random_uuid() as outsider_id;
grant select on screen_test_ids to authenticated,anon;
insert into auth.users(id,email) select admin_id,'screen-admin-'||admin_id||'@example.invalid' from screen_test_ids
 union all select trainer_id,'screen-trainer-'||trainer_id||'@example.invalid' from screen_test_ids
 union all select outsider_id,'screen-outsider-'||outsider_id||'@example.invalid' from screen_test_ids;
insert into public.profiles(id,display_name,is_admin) select admin_id,'Screen Test Admin',true from screen_test_ids
 union all select trainer_id,'Screen Test Trainer',false from screen_test_ids
 union all select outsider_id,'Screen Test Outsider',false from screen_test_ids
 on conflict(id) do update set is_admin=excluded.is_admin;
insert into public.memberships(user_id,team_season_id,role) select t.trainer_id,e.team_season_id,'trainer' from screen_test_ids t join public.events e on e.id=t.event_id;
insert into public.club_admin_assignments(club_id,user_id,is_active)
 select t.club_id,x.outsider_id,true from screen_test_ids x join public.events e on e.id=x.event_id
 join public.team_seasons ts on ts.id=e.team_season_id join public.teams t on t.id=ts.team_id;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select trainer_id::text from screen_test_ids),true);
do $$begin if (public.tournament_screen_access((select event_id from screen_test_ids))->>'canScreen')::boolean then raise exception 'Unassigned trainer allowed';end if;end $$;
select set_config('request.jwt.claim.sub',(select outsider_id::text from screen_test_ids),true);
do $$begin
 if not (public.tournament_screen_access((select event_id from screen_test_ids))->>'canManage')::boolean then raise exception 'Club admin denied';end if;
 if (public.tournament_screen_access(gen_random_uuid())->>'canManage')::boolean then raise exception 'Club admin escaped event scope';end if;
end $$;
reset role;
delete from public.club_admin_assignments where user_id=(select outsider_id from screen_test_ids);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from screen_test_ids),true);
do $$ declare e uuid;u uuid;begin
 select event_id,trainer_id into e,u from screen_test_ids;
 if e is null then raise exception 'Missing tournament fixture'; end if;
 if not (public.tournament_screen_access(e)->>'canManage')::boolean then raise exception 'Admin rejected';end if;
 perform public.tournament_screen_members(e);
 perform public.tournament_screen_assign(e,u,true);perform public.tournament_screen_assign(e,u,true);
 begin perform public.tournament_screen_assign(e,(select outsider_id from screen_test_ids),true);raise exception 'Outsider assigned';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_screen_assign(e,u,null);raise exception 'Null assigned';exception when invalid_parameter_value then null;end;
end $$;
select set_config('request.jwt.claim.sub',(select trainer_id::text from screen_test_ids),true);
do $$ declare e uuid;begin
 select event_id into e from screen_test_ids;
 if not (public.tournament_screen_access(e)->>'canScreen')::boolean then raise exception 'Director rejected';end if;
 if (public.tournament_screen_access(e)->>'canManage')::boolean then raise exception 'Director got admin';end if;
 if (public.tournament_screen_access(gen_random_uuid())->>'canScreen')::boolean then raise exception 'Wrong event authorized';end if;
 begin perform public.tournament_screen_assign(e,(select outsider_id from screen_test_ids),true);raise exception 'Escalated';exception when insufficient_privilege then null;end;
 begin perform public.tournament_screen_members(e);raise exception 'Member list leaked';exception when insufficient_privilege then null;end;
 begin perform 1 from public.tournament_screen_directors;raise exception 'Private table exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',(select outsider_id::text from screen_test_ids),true);
do $$ begin if (public.tournament_screen_access((select event_id from screen_test_ids))->>'canScreen')::boolean then raise exception 'Outsider allowed';end if;end $$;
select set_config('request.jwt.claim.sub',(select admin_id::text from screen_test_ids),true);
do $$begin
 perform public.tournament_screen_assign((select event_id from screen_test_ids),(select trainer_id from screen_test_ids),false);
 perform public.tournament_screen_assign((select event_id from screen_test_ids),(select trainer_id from screen_test_ids),false);
end $$;
select set_config('request.jwt.claim.sub',(select trainer_id::text from screen_test_ids),true);
do $$begin if (public.tournament_screen_access((select event_id from screen_test_ids))->>'canScreen')::boolean then raise exception 'Revoked director allowed';end if;end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if (public.tournament_screen_access((select event_id from screen_test_ids))->>'canScreen')::boolean then raise exception 'Anonymous allowed';end if;end $$;
rollback;
