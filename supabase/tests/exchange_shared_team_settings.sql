begin;
do $setup$
declare a uuid:=(select user_id from public.user_roles where role::text='admin' limit 1); u uuid:=gen_random_uuid(); c uuid; d uuid; t uuid:=gen_random_uuid();
begin
 select club_id into c from private.exchange_join_settings where self_join_enabled limit 1;
 select id into d from public.clubs where id<>c and name in ('NSG Gölsental','USC Rohrbach') order by name limit 1;
 insert into private.exchange_team_settings_sources values(c,c),(d,c) on conflict do nothing;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values(u,u::text||'@shared-settings.invalid',now(),'{}','{}',now(),now());
 insert into private.exchange_members(club_id,user_id) values(c,u),(d,u);
 insert into public.teams(id,club_id,name,age_group) values(t,c,'Shared synthetic','U8');
 if not exists(select 1 from public.exchange_partner_teams where club_id=d and team_id=t) then raise exception 'Future team pool not aligned';end if;
 perform set_config('shared.admin',a::text,true);perform set_config('shared.user',u::text,true);perform set_config('shared.c',c::text,true);perform set_config('shared.d',d::text,true);perform set_config('shared.t',t::text,true);
end $setup$;
set local role authenticated;
do $test$
declare c uuid:=current_setting('shared.c')::uuid;d uuid:=current_setting('shared.d')::uuid;t uuid:=current_setting('shared.t')::uuid;r jsonb;s jsonb;v int;denied boolean;
begin
 perform set_config('request.jwt.claim.sub',current_setting('shared.admin'),true);
 r:=public.exchange_parent_teams_admin(c);v:=(r->>'version')::int;
 r:=public.exchange_parent_teams_admin(d,jsonb_build_array(jsonb_build_object('id',t,'label','SPG St. Veit U8')),v);
 s:=public.exchange_parent_teams_admin(c);
 if s->>'version'<>r->>'version' then raise exception 'Version not shared';end if;
 if not exists(select 1 from jsonb_array_elements(s->'teams') e where e->>'id'=t::text and e->>'label'='SPG St. Veit U8' and (e->>'enabled')::boolean) then raise exception 'Saved label not shared';end if;
 denied:=false;begin perform public.exchange_parent_teams_admin(c,'[]',v);exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'Stale save accepted';end if;
 denied:=false;begin perform public.exchange_parent_teams_admin(c,jsonb_build_array(jsonb_build_object('id',gen_random_uuid())),(s->>'version')::int);exception when others then denied:=true;end;
 if not denied then raise exception 'Foreign team accepted';end if;
 perform set_config('request.jwt.claim.sub',current_setting('shared.user'),true);
 r:=public.exchange_team_options(c,null);s:=public.exchange_team_options(d,null);
 if r<>s or jsonb_array_length(r)<>1 or r->0->>'name'<>'SPG St. Veit U8' then raise exception 'Registration differs: %, %',r,s;end if;
 denied:=false;begin perform public.exchange_parent_teams_admin(c);exception when others then denied:=true;end;
 if not denied then raise exception 'Unprivileged settings access accepted';end if;
end $test$;
reset role;
select 'PASS shared save/read/options, future team linking, stale save rejected, invalid team rejected, unauthorized user rejected' result;
rollback;
