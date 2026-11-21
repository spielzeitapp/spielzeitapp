begin;
do $setup$
declare c uuid:=(select club_id from private.exchange_join_settings where self_join_enabled limit 1);a uuid:=(select user_id from public.user_roles where role::text='admin' limit 1);u uuid:=gen_random_uuid();t uuid:=gen_random_uuid();t2 uuid:=gen_random_uuid();r jsonb;l uuid:=gen_random_uuid();th uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values(u,u::text||'@label-test.invalid',now(),'{"market_show_team":true}','{}',now(),now());
 insert into private.exchange_members(club_id,user_id) values(c,u);
 insert into public.teams(id,club_id,name,age_group) values(t,c,'U12 SPG Rohrbach','U12'),(t2,c,'SPG Hainfeld','U12');
 insert into private.exchange_member_teams(club_id,user_id,team_id) values(c,u,t),(c,u,t2);
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.exchange_parent_teams_admin(c);
 perform public.exchange_parent_teams_admin(c,jsonb_build_array(jsonb_build_object('id',t,'label','U12'),jsonb_build_object('id',t2,'label',null)),(r->>'version')::int);
 if private.exchange_parent_team_label(c,t)<>'SPG Rohrbach U12' or private.exchange_parent_team_label(c,t2)<>'SPG Hainfeld U12' then raise exception 'Full names not distinct or age duplicated';end if;
 insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,status,photo_paths) values(l,c,a,'Label synthetic','Pulli','128','Gut','Gratis','Verfügbar',array[c::text||'/'||a::text||'/'||l::text||'/test.jpg']);
 insert into public.exchange_threads(id,listing_id,requester_id) values(th,l,u);
 if (select requester_team_label from public.exchange_threads where id=th) not like '%SPG Rohrbach U12%' then raise exception 'Message label missing full identity';end if;
 perform set_config('labels.thread',th::text,true);
 perform set_config('labels.club',c::text,true);perform set_config('labels.user',u::text,true);
end $setup$;
set local role authenticated;
do $test$
declare c uuid:=current_setting('labels.club')::uuid;u uuid:=current_setting('labels.user')::uuid;r jsonb;names text;denied boolean;
begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.exchange_my_clubs();
 select x->'team_labels' into r from jsonb_array_elements(r) x where x->>'club_id'=c::text;
 if jsonb_array_length(r)<>2 or not(r @> '["SPG Rohrbach U12","SPG Hainfeld U12"]'::jsonb) then raise exception 'Profile lost full team labels or associations';end if;
 r:=public.exchange_team_options(c,null);
 select string_agg(x->>'name',';') into names from jsonb_array_elements(r) x;
 if names not like '%SPG Rohrbach U12%' or names not like '%SPG Hainfeld U12%' then raise exception 'Registration options missing full names: %',names;end if;
 if has_function_privilege('anon','private.exchange_full_team_label(uuid,uuid)','execute') then raise exception 'Private label helper exposed';end if;
end $test$;
reset role;
update auth.users set raw_user_meta_data=jsonb_set(raw_user_meta_data,'{market_show_team}','false') where id=current_setting('labels.user')::uuid;
do $$begin if (select requester_team_label from public.exchange_threads where id=current_setting('labels.thread')::uuid)<>'' then raise exception 'Opt-out did not redact old message labels';end if;end;$$;
select 'PASS authenticated profile/registration full names, identical ages distinct teams, short alias fallback, no duplicated U, unchanged team IDs, private helper not exposed' result;
rollback;
