begin;
set local role anon;
do $$begin
 begin perform 1 from public.tournament_audience_push;raise exception 'anon read was allowed';exception when insufficient_privilege then null;end;
 begin perform public.tournament_audience_push_claim();raise exception 'anon claim was allowed';exception when insufficient_privilege then null;end;
 begin perform public.tournament_audience_push_rate(repeat('a',64));raise exception 'anon quota was allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
do $$begin
 begin delete from public.tournament_audience_push;raise exception 'authenticated delete was allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.tournament_audience_push_tickets;raise exception 'ticket read was allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role service_role;
do $$declare event uuid; row_id uuid; token uuid; n integer; begin
 select id into event from public.events where kind='tournament' and starts_at between now()-interval '2 days' and now()+interval '45 days' limit 1;
 if event is null then raise exception 'No tournament fixture available'; end if;
 begin insert into public.tournament_audience_push(device_hash,event_id,endpoint,p256dh,auth) values('invalid',event,'https://example.invalid/negative','','');raise exception 'invalid capability accepted';exception when check_violation then null;end;
 insert into public.tournament_audience_push(device_hash,event_id,endpoint,p256dh,auth) values(repeat('f',64),event,'https://example.invalid/synthetic-audience-push','','') returning id into row_id;
 if not exists(select 1 from public.tournament_audience_push_claim() where id=row_id) then raise exception 'service claim failed';end if;
 if exists(select 1 from public.tournament_audience_push_claim() where id=row_id) then raise exception 'repeat claim duplicated lease';end if;
 update public.tournament_audience_push set snapshot='{"stale":true}' where id=row_id and lease_until='-infinity';get diagnostics n=row_count;
 if n<>0 then raise exception 'stale worker overwrote current state';end if;
 for i in 1..60 loop if not public.tournament_audience_push_rate(repeat('e',64)) then raise exception 'quota rejected too early';end if;end loop;
 if public.tournament_audience_push_rate(repeat('e',64)) then raise exception 'quota did not stop abuse';end if;
 insert into public.tournament_audience_push_tickets default values returning id into token;
 delete from public.tournament_audience_push_tickets where id=token and expires_at>now();get diagnostics n=row_count;if n<>1 then raise exception 'ticket consumption failed';end if;
 delete from public.tournament_audience_push_tickets where id=token;get diagnostics n=row_count;if n<>0 then raise exception 'ticket replay allowed';end if;
end$$;
reset role;
rollback;
select 'PASS: actual anon/authenticated restrictions, service role, invalid values, lease replay, stale state, quota and one-use tickets; fixtures rolled back' result;
