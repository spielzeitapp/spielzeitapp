begin;
do $test$
declare c uuid:=(select id from public.clubs where name ilike '%gölsen%' or name ilike '%rohrbach%' order by case when name ilike '%gölsen%' then 0 else 1 end limit 1);a uuid:=(select user_id from public.user_roles where role::text='admin' limit 1);u uuid:=gen_random_uuid();m uuid:=gen_random_uuid();t uuid;central uuid:=gen_random_uuid();r jsonb;denied boolean;v integer;
begin
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values(u,u::text||'@team-edit-test.invalid','{}','{}',now(),now()),(m,m::text||'@team-edit-test.invalid','{}','{}',now(),now());
 insert into private.exchange_members(club_id,user_id) values(c,u),(c,m);
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform public.exchange_manager_assign(c,u,false,true);perform public.exchange_manager_assign(c,m,true,false);
 insert into public.teams(id,club_id,name,age_group) values(central,c,'U12 Zentralprüfung '||central::text,'U12');
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.exchange_manager_create_team(c,'U12 Prüfung '||u::text,'U12');t:=(r->>'team_id')::uuid;
 if not exists(select 1 from private.exchange_manual_teams where team_id=t and created_by=u) then raise exception 'Missing provenance';end if;
 insert into private.exchange_member_teams(club_id,user_id,team_id) values(c,m,t);
 r:=public.exchange_parent_teams_admin(c);v:=(r->>'version')::integer;
 r:=public.exchange_parent_teams_admin(c,jsonb_build_array(jsonb_build_object('id',t,'label','U12 Elternname')),v);
 r:=public.exchange_manager_update_team(c,t,'U13 Prüfung '||u::text,'U13',1);
 if not exists(select 1 from jsonb_array_elements(r->'teams') x where x->>'id'=t::text and x->>'name'='U13 Prüfung '||u::text and x->>'age_group'='U13' and (x->>'can_edit')::boolean and (x->>'edit_version')::integer=2 and x->>'label'='U12 Elternname' and (x->>'enabled')::boolean) then raise exception 'Updated response lost label, selection, revision or identity';end if;
 if not exists(select 1 from private.exchange_member_teams where club_id=c and user_id=m and team_id=t) then raise exception 'Parent membership lost';end if;
 denied:=false;begin perform public.exchange_manager_update_team(c,t,'U14 stale','U14',1);exception when serialization_failure then denied:=true;end;if not denied then raise exception 'Stale edit accepted';end if;
 denied:=false;begin perform public.exchange_manager_update_team(c,central,'U13 central','U13',1);exception when others then denied:=true;end;if not denied then raise exception 'Central team edited';end if;
 r:=public.exchange_manager_create_team(c,'U12 Zentralprüfung '||central::text,'U12');if r->>'status'<>'exists' or exists(select 1 from private.exchange_manual_teams where team_id=central) then raise exception 'Existing central team acquired manual origin';end if;
 denied:=false;begin perform public.exchange_manager_update_team(gen_random_uuid(),t,'U13 cross','U13',2);exception when others then denied:=true;end;if not denied then raise exception 'Cross-club edited';end if;
 denied:=false;begin perform public.exchange_manager_update_team(c,t,'U12 Zentralprüfung '||central::text,'U12',2);exception when others then denied:=true;end;if not denied then raise exception 'Duplicate name accepted';end if;
 perform set_config('request.jwt.claim.sub',m::text,true);
 denied:=false;begin perform public.exchange_manager_update_team(c,t,'U13 no rights','U13',2);exception when others then denied:=true;end;if not denied then raise exception 'Market-only role edited team';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.team_seasons(team_id,season_id) select t,season_id from public.team_seasons limit 1;
 denied:=false;begin perform public.exchange_manager_update_team(c,t,'U13 season','U13',2);exception when others then denied:=true;end;if not denied then raise exception 'Season-linked team edited';end if;
 r:=public.exchange_parent_teams_admin(c);if exists(select 1 from jsonb_array_elements(r->'teams') x where x->>'id'=t::text and (x->>'can_edit')::boolean) then raise exception 'Season team still editable in UI';end if;
 if has_function_privilege('anon','public.exchange_manager_update_team(uuid,uuid,text,text,integer)','execute') or has_table_privilege('authenticated','private.exchange_manual_teams','INSERT') or has_table_privilege('authenticated','private.exchange_manual_teams','UPDATE') then raise exception 'Provenance permissions exposed';end if;
 perform set_config('test.team_edit_club',c::text,true);
end $test$;
set local role authenticated;
do $role$
declare c uuid:=current_setting('test.team_edit_club')::uuid;r jsonb;t uuid;denied boolean;
begin
 r:=public.exchange_manager_create_team(c,'U7 Rollenprüfung '||gen_random_uuid()::text,'U7');t:=(r->>'team_id')::uuid;
 perform public.exchange_manager_update_team(c,t,'U8 Rollenprüfung '||t::text,'U8',1);
 denied:=false;begin perform 1 from private.exchange_manual_teams;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct provenance read exposed';end if;
end $role$;
reset role;
select 'PASS provenance, delegated team edit, unchanged identity/membership/approval/label, conflict, central/season/cross-club/duplicate/market-only protections and private grants' result;
rollback;
