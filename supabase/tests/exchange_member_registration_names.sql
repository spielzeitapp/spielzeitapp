begin;
do $setup$
declare c uuid:=(select club_id from private.exchange_join_settings where self_join_enabled limit 1);a uuid:=(select user_id from public.user_roles where role::text='admin' limit 1);u uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values(u,u::text||'@member-name.invalid',now(),'{"first_name":" Trainer ","last_name":" QUETSCHNGURU ","role":"admin"}','{}',now(),now());
 insert into private.exchange_members(club_id,user_id) values(c,u);
 perform set_config('names.club',c::text,true);perform set_config('names.admin',a::text,true);perform set_config('names.user',u::text,true);
end $setup$;
set local role authenticated;
do $allowed$ declare r jsonb;c uuid:=current_setting('names.club')::uuid;u uuid:=current_setting('names.user')::uuid;begin
 perform set_config('request.jwt.claim.sub',current_setting('names.admin'),true);
 select x into r from jsonb_array_elements(public.exchange_members_list(c)) x where x->>'user_id'=u::text;
 if r->>'name'<>'Trainer QUETSCHNGURU' then raise exception 'Registration name not used: %',r;end if;
 if r ? 'email' or r ? 'raw_user_meta_data' then raise exception 'Auth data exposed';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.exchange_members_list(c);raise exception 'unauthorized accepted';exception when others then if SQLERRM='unauthorized accepted' then raise;end if;end;
end $allowed$;
reset role;
update auth.users set raw_user_meta_data='{"full_name":" Anna Beispiel "}' where id=current_setting('names.user')::uuid;
select set_config('request.jwt.claim.sub',current_setting('names.admin'),true);
set local role authenticated;
do $$begin if not exists(select 1 from jsonb_array_elements(public.exchange_members_list(current_setting('names.club')::uuid)) x where x->>'user_id'=current_setting('names.user') and x->>'name'='Anna Beispiel') then raise exception 'full_name fallback failed';end if;end;$$;
reset role;
update auth.users set raw_user_meta_data='{}' where id=current_setting('names.user')::uuid;
set local role authenticated;
do $$begin if not exists(select 1 from jsonb_array_elements(public.exchange_members_list(current_setting('names.club')::uuid)) x where x->>'user_id'=current_setting('names.user') and x->>'name'='Vereinsmitglied') then raise exception 'missing-name fallback failed';end if;end;$$;
reset role;
select 'PASS registration identity, full_name fallback, empty fallback, member cannot access admin list or grant role via metadata, no emails/auth fields returned' result;
rollback;
