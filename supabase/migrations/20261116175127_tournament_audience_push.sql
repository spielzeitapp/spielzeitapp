-- Public spectator Push: opaque per-device capability, no account or table access.
create table public.tournament_audience_push (
 id uuid primary key default gen_random_uuid(),
 device_hash text not null check(device_hash ~ '^[a-f0-9]{64}$'),
 event_id uuid not null references public.events(id) on delete cascade,
 team text not null default '' check(length(team)<=160),
 endpoint text not null check(length(endpoint)<=2048),
 p256dh text not null, auth text not null,
 snapshot jsonb not null default '{}'::jsonb check(pg_column_size(snapshot)<65536),
 lease_until timestamptz not null default '-infinity',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '45 days',
 unique(device_hash,event_id),unique(endpoint,event_id)
);
create index on public.tournament_audience_push(expires_at,lease_until);
alter table public.tournament_audience_push enable row level security;
revoke all on public.tournament_audience_push from public,anon,authenticated;
grant all on public.tournament_audience_push to service_role;
create table public.tournament_audience_push_tickets(id uuid primary key default gen_random_uuid(),expires_at timestamptz not null default now()+interval '2 minutes');
alter table public.tournament_audience_push_tickets enable row level security;
revoke all on public.tournament_audience_push_tickets from public,anon,authenticated;
grant all on public.tournament_audience_push_tickets to service_role;
create table public.tournament_audience_push_limits(key text primary key,hits integer not null default 1,window_at timestamptz not null default now());
alter table public.tournament_audience_push_limits enable row level security;
revoke all on public.tournament_audience_push_limits from public,anon,authenticated;
grant all on public.tournament_audience_push_limits to service_role;
create function public.tournament_audience_push_rate(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_key is null or length(p_key)<>64 then return false; end if;
 insert into public.tournament_audience_push_limits as q(key) values(p_key)
 on conflict(key) do update set hits=case when q.window_at<now()-interval '1 hour' then 1 else q.hits+1 end,
 window_at=case when q.window_at<now()-interval '1 hour' then now() else q.window_at end returning hits into n;
 return n<=60;
end $$;
revoke all on function public.tournament_audience_push_rate(text) from public,anon,authenticated;
grant execute on function public.tournament_audience_push_rate(text) to service_role;
create function public.tournament_audience_push_claim() returns setof public.tournament_audience_push language sql security invoker set search_path='' as $$
 update public.tournament_audience_push as p set lease_until=now()+interval '2 minutes'
 where p.id in(select s.id from public.tournament_audience_push s join public.events e on e.id=s.event_id
 where s.expires_at>now() and s.lease_until<now() and e.kind='tournament'
 and e.starts_at between now()-interval '2 days' and now()+interval '45 days'
 order by s.lease_until,s.id limit 100 for update of s skip locked) returning p.*;
$$;
revoke all on function public.tournament_audience_push_claim() from public,anon,authenticated;
grant execute on function public.tournament_audience_push_claim() to service_role;
-- Private DB scheduler creates short-lived, one-use dispatch tickets. No server key in HTTP or browser.
create function tournament_sync.audience_push_tick() returns void language plpgsql security definer set search_path='' as $$
declare origin text; ticket uuid;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('audience-push-tick',0)) then return; end if;
 select c.origin into origin from tournament_sync.config c where singleton;
 -- This feature is TEST-only until an explicitly reviewed LIVE release.
 if origin is distinct from 'https://app.spielzeitapp.at' then return; end if;
 delete from public.tournament_audience_push where expires_at<now();
 delete from public.tournament_audience_push_limits where window_at<now()-interval '1 day';
 delete from public.tournament_audience_push_tickets where expires_at<now();
 if not exists(select 1 from public.tournament_audience_push where expires_at>now()) then return; end if;
 insert into public.tournament_audience_push_tickets default values returning id into ticket;
 perform net.http_post(url:=origin||'/api/tournament-plan-analyze?audiencePush=dispatch',
 headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=55000);
end $$;
revoke all on function tournament_sync.audience_push_tick() from public,anon,authenticated,service_role;
select cron.schedule('tournament-audience-push','* * * * *','select tournament_sync.audience_push_tick();');
select pg_notify('pgrst','reload schema');
