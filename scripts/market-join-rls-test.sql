-- Synthetic rollback-only integration test; no emails, API calls or push delivery.
begin;
create temp table market_probe as select gen_random_uuid() club_id, gen_random_uuid() other_club_id,gen_random_uuid() admin_id,gen_random_uuid() parent_id,gen_random_uuid() unconfirmed_id,gen_random_uuid() outsider_id;
grant select on market_probe to authenticated;
insert into public.clubs(id,name,status) select club_id,'Synthetic market invitation','active' from market_probe union all select other_club_id,'Synthetic other market','active' from market_probe;
insert into auth.users(id,email,email_confirmed_at) select u,u::text||'@market-probe.invalid',case when u=unconfirmed_id then null else now() end from market_probe,lateral unnest(array[admin_id,parent_id,unconfirmed_id,outsider_id])u;
insert into public.user_roles(user_id,role) select admin_id,'admin' from market_probe;
create function pg_temp.check(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAILED: %',label; end if;end$$;
select set_config('request.jwt.claim.sub',admin_id::text,true) from market_probe;
set local role authenticated;
create temp table market_invite as select public.exchange_invitation(club_id) data from market_probe;
select pg_temp.check((select data->>'token' from market_invite)=(public.exchange_invitation(club_id)->>'token'),'repeat generation preserves link') from market_probe;
select set_config('request.jwt.claim.sub',parent_id::text,true) from market_probe;
select pg_temp.check(not public.exchange_access(club_id),'new account has no access') from market_probe;
select pg_temp.check(not has_table_privilege('authenticated','private.exchange_members','INSERT'),'no direct membership writes');
select pg_temp.check(not has_table_privilege('authenticated','private.exchange_invitations','SELECT'),'no token table access');
select pg_temp.check(not has_function_privilege('anon','public.exchange_join(uuid,text,boolean)','EXECUTE'),'anonymous cannot join');
do $$begin
 begin perform public.exchange_invitation(club_id) from market_probe;raise exception 'admin gate bypassed';exception when raise_exception then if sqlerrm='admin gate bypassed' then raise;end if;end;
 begin perform public.exchange_join(club_id,repeat('0',64),true) from market_probe;raise exception 'invalid accepted';exception when raise_exception then if sqlerrm='invalid accepted' then raise;end if;end;
 begin perform public.exchange_join(other_club_id,(select data->>'token' from market_invite),true) from market_probe;raise exception 'cross club accepted';exception when raise_exception then if sqlerrm='cross club accepted' then raise;end if;end;
 begin perform public.exchange_join(club_id,(select data->>'token' from market_invite),false) from market_probe;raise exception 'consent bypassed';exception when raise_exception then if sqlerrm='consent bypassed' then raise;end if;end;
end$$;
select public.exchange_join(club_id,(select data->>'token' from market_invite),true) from market_probe;
select public.exchange_join(club_id,(select data->>'token' from market_invite),true) from market_probe;
select pg_temp.check(public.exchange_access(club_id),'market-only parent has access') from market_probe;
select pg_temp.check(not public.exchange_access(other_club_id),'other club denied') from market_probe;
select pg_temp.check(jsonb_array_length(public.exchange_my_clubs())=1,'only joined club returned');
insert into public.exchange_listings(club_id,title,category,size,condition,offer,status) select club_id,'Synthetic market shirt','Pulli','140','Gut','Gratis','Entwurf' from market_probe;
select pg_temp.check((select count(*) from public.exchange_listings where title='Synthetic market shirt')=1,'market-only parent can create own draft');
select set_config('request.jwt.claim.sub',outsider_id::text,true) from market_probe;
select pg_temp.check((select count(*) from public.exchange_listings where title='Synthetic market shirt')=0,'outsider cannot read draft');
do $$begin
 begin insert into public.exchange_listings(club_id,title,category,size,condition,offer,status) select club_id,'Unauthorized draft','Pulli','140','Gut','Gratis','Entwurf' from market_probe;raise exception 'outsider write accepted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',unconfirmed_id::text,true) from market_probe;
do $$begin
 begin perform public.exchange_join(club_id,(select data->>'token' from market_invite),true) from market_probe;raise exception 'unconfirmed accepted';exception when raise_exception then if sqlerrm='unconfirmed accepted' then raise;end if;end;
end$$;
reset role;
select pg_temp.check(not exists(select 1 from public.memberships where user_id=(select parent_id from market_probe)),'no team membership created');
select pg_temp.check(not exists(select 1 from public.player_guardians where user_id=(select parent_id from market_probe)),'no child link created');
select pg_temp.check((select count(*) from private.exchange_members where user_id=(select parent_id from market_probe))=1,'repeat join idempotent');
select set_config('request.jwt.claim.sub',admin_id::text,true) from market_probe;
set local role authenticated;
select pg_temp.check((public.exchange_invitation(club_id,true)->>'token')<>(select data->>'token' from market_invite),'rotation invalidates old token') from market_probe;
select set_config('request.jwt.claim.sub',outsider_id::text,true) from market_probe;
do $$begin
 begin perform public.exchange_join(club_id,(select data->>'token' from market_invite),true) from market_probe;raise exception 'rotated accepted';exception when raise_exception then if sqlerrm='rotated accepted' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',parent_id::text,true) from market_probe;
select pg_temp.check(public.exchange_access(club_id),'rotation preserves joined parents') from market_probe;
select set_config('request.jwt.claim.sub',admin_id::text,true) from market_probe;
select public.exchange_revoke(club_id,parent_id) from market_probe;
select set_config('request.jwt.claim.sub',parent_id::text,true) from market_probe;
select pg_temp.check(not public.exchange_access(club_id),'revoked market-only member denied') from market_probe;
reset role;
update private.exchange_invitations set expires_at=now()-interval '1 second' where club_id=(select club_id from market_probe);
select set_config('request.jwt.claim.sub',outsider_id::text,true) from market_probe;
create temp table expired_token as select token from private.exchange_invitations where club_id=(select club_id from market_probe);
grant select on expired_token to authenticated;
set local role authenticated;
do $$begin
 begin perform public.exchange_join(club_id,(select token from expired_token),true) from market_probe;raise exception 'expired accepted';exception when raise_exception then if sqlerrm='expired accepted' then raise;end if;end;
end$$;
reset role;
rollback;
select 'PASS: invitation authorization, confirmed email, consent, club isolation, market RLS, repeat join, rotation, expiry, revocation and no team/child assignment' result;
