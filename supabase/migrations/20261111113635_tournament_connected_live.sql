-- Environment activation is separate: TEST first, no LIVE origin or test data embedded.
create schema if not exists tournament_sync;
revoke all on schema tournament_sync from public,anon,authenticated,service_role;
create table public.tournament_sync_state (
 event_id uuid primary key references public.events(id) on delete cascade,
 source_url text not null,
 own_team_name text,
 analysis jsonb not null default '{}'::jsonb,
 synced_at timestamptz,
 last_error text
);
alter table public.tournament_sync_state enable row level security;
revoke all on public.tournament_sync_state from authenticated;
grant select on public.tournament_sync_state to authenticated;
revoke all on public.tournament_sync_state from anon;
create policy tournament_sync_read on public.tournament_sync_state for select to authenticated using (
 exists(select 1 from public.events e join public.memberships ms on ms.team_season_id=e.team_season_id where e.id=event_id and ms.user_id=auth.uid()) or public.is_platform_admin());

create table public.tournament_reminder_subscriptions (
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 primary key(event_id,user_id)
);
alter table public.tournament_reminder_subscriptions enable row level security;
grant select,insert,update,delete on public.tournament_reminder_subscriptions to authenticated;
revoke all on public.tournament_reminder_subscriptions from anon;
create policy tournament_reminder_self on public.tournament_reminder_subscriptions for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.events e join public.memberships m on m.team_season_id=e.team_season_id where e.id=event_id and e.kind='tournament' and m.user_id=auth.uid()));

create table tournament_sync.config(singleton boolean primary key default true check(singleton),origin text not null check(origin in ('https://app.spielzeitapp.at','https://spielzeitapp.at')),reminder_url text not null check(reminder_url ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/send-reminders[?]tournamentOnly=1$'));
create table tournament_sync.tasks(event_id uuid primary key references public.events(id) on delete cascade,source_url text not null,request_id bigint,requested_at timestamptz,next_at timestamptz not null default now());
alter table tournament_sync.config enable row level security;
alter table tournament_sync.tasks enable row level security;
revoke all on all tables in schema tournament_sync from public,anon,authenticated,service_role;

create function tournament_sync.reconcile(p_event uuid,p_url text,p_analysis jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype; ts public.team_seasons%rowtype; s public.tournament_matches%rowtype; m public.matches%rowtype; g jsonb; t jsonb; own_name text; v_opponent text; ext text; kick timestamptz; mid uuid; is_own boolean; seq integer:=0; hg integer; ag integer; own_home boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('tournament:'||p_event::text,0));
 select * into e from public.events where id=p_event and kind='tournament' and official_tournament_url=p_url and tournament_completed_at is null and coalesce(status,'upcoming') not in ('cancelled','canceled','deleted') for update;
 if not found then raise exception 'Turnier nicht aktiv oder Quelllink geändert'; end if;
 select * into ts from public.team_seasons where id=e.team_season_id and status in ('active','draft') for share;
 if not found then raise exception 'Saison ist nicht bearbeitbar'; end if;
 if p_analysis->>'provider' not in ('meinturnierplan','tournament-live') or jsonb_typeof(p_analysis->'rawMatches') is distinct from 'array' or jsonb_array_length(p_analysis->'rawMatches') not between 1 and 500 or jsonb_typeof(p_analysis->'teams') is distinct from 'array' or jsonb_array_length(p_analysis->'teams')>100 then raise exception 'Ungültiger Turnierplan'; end if;
 if p_analysis->>'fetchedAt' is not null then
  if (p_analysis->>'fetchedAt')::timestamptz>now()+interval '1 minute' then raise exception 'Ungültiger Abrufzeitpunkt'; end if;
  if exists(select 1 from public.tournament_sync_state st where st.event_id=p_event and st.source_url=p_url and (st.analysis->>'fetchedAt')::timestamptz>(p_analysis->>'fetchedAt')::timestamptz) then return; end if;
 end if;
 insert into public.tournament_sync_state(event_id,source_url) values(p_event,p_url) on conflict(event_id) do nothing;
 select case when source_url=p_url then own_team_name else null end into own_name from public.tournament_sync_state where event_id=p_event;
 -- No fuzzy match: Rohrbach and Rohrbach U11 are different participants.
 if own_name is null then
  select jt->>'teamName' into own_name from jsonb_array_elements(p_analysis->'teams') jt where lower(trim(jt->>'teamName')) in (lower(trim(coalesce(ts.display_name,''))),lower(trim(coalesce((select name from public.teams where id=ts.team_id),'')))) limit 1;
 end if;
 if own_name is not null and not exists(select 1 from jsonb_array_elements(p_analysis->'teams') jt where jt->>'teamName'=own_name) then own_name:=null; end if;
 for t in select value from jsonb_array_elements(p_analysis->'teams') loop
  if length(t->>'teamName') not between 1 and 150 then raise exception 'Ungültige Mannschaft'; end if;
  update public.tournament_participants set group_label=t->>'groupLabel' where tournament_event_id=p_event and team_name=t->>'teamName';
  if not found then insert into public.tournament_participants(tournament_event_id,team_name,group_label) values(p_event,t->>'teamName',t->>'groupLabel'); end if;
 end loop;
 for g in select value from jsonb_array_elements(p_analysis->'rawMatches') loop
  seq:=seq+1;
  if coalesce(g->>'externalMatchId','')='' then continue; end if;
  if length(g->>'homeTeam') not between 1 and 150 or length(g->>'awayTeam') not between 1 and 150 or coalesce(g->>'kickoffTimeHHmm','')!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Ungültiges Spiel'; end if;
  ext:=(p_analysis->>'provider')||':'||(g->>'externalMatchId');
  kick:=((e.starts_at at time zone 'Europe/Vienna')::date + (g->>'kickoffTimeHHmm')::time) at time zone 'Europe/Vienna';
  own_home:=own_name is not null and g->>'homeTeam'=own_name and coalesce((g->>'homeConfirmed')::boolean,true);
  is_own:=own_home or (own_name is not null and g->>'awayTeam'=own_name and coalesce((g->>'awayConfirmed')::boolean,true));
  -- An unresolved opponent is never made playable or notified.
  is_own:=is_own and coalesce((g->>'homeConfirmed')::boolean,true) and coalesce((g->>'awayConfirmed')::boolean,true);
  v_opponent:=case when own_home then g->>'awayTeam' else g->>'homeTeam' end;
  select * into s from public.tournament_matches where tournament_event_id=p_event and external_match_id=ext for update;
  if not found then
   -- Upgrade old importer identities without duplicating existing ticker games.
   select * into s from public.tournament_matches where tournament_event_id=p_event and (external_match_id is null or external_match_id like 'meinturnierplan:%') and kickoff_at=kick and ( (home_team=g->>'homeTeam' and away_team=g->>'awayTeam') or (match_id is not null and opponent_name=v_opponent and is_own)) order by created_at limit 1 for update;
  end if;
  hg:=null;ag:=null;
  if (g->>'hasResult')::boolean and coalesce(g->>'homeGoals','')~ '^\d{1,2}$' and coalesce(g->>'awayGoals','')~ '^\d{1,2}$' then hg:=(g->>'homeGoals')::integer;ag:=(g->>'awayGoals')::integer; end if;
  mid:=s.match_id;
  if mid is not null then
   select * into m from public.matches where id=mid for update;
   -- Never reassign or remove a live/finished/manual game after an organizer correction.
   if not is_own or s.source='manual_override' then continue; end if;
   if m.status='upcoming' and m.live_started_at is null and not exists(select 1 from public.match_events where match_id=mid) then
    update public.matches set match_date=kick,opponent=v_opponent,planned_match_minutes=greatest(1,least(120,coalesce((g->>'plannedMinutes')::integer,10))) where id=mid;
   end if;
  elsif is_own then
   insert into public.matches(team_season_id,opponent,match_date,location,status,planned_match_minutes,motm_enabled,auto_matchday_feed_enabled) values(e.team_season_id,v_opponent,kick,e.location,'upcoming',greatest(1,least(120,coalesce((g->>'plannedMinutes')::integer,10))),false,false) returning id into mid;
  end if;
  if s.id is null then
   insert into public.tournament_matches(tournament_event_id,match_id,opponent_name,kickoff_at,planned_minutes,pitch,group_label,phase,sort_order,home_team,away_team,is_own_team,source,provider,external_match_id,official_status,home_goals,away_goals)
    values(p_event,mid,case when is_own then v_opponent else (g->>'homeTeam')||' vs '||(g->>'awayTeam') end,kick,greatest(1,least(120,coalesce((g->>'plannedMinutes')::integer,10))),g->>'pitch',g->>'groupLabel',g->>'phase',seq,g->>'homeTeam',g->>'awayTeam',is_own,case when is_own then 'spielzeitapp' else 'official' end,p_analysis->>'provider',ext,case when hg is not null then 'finished' else 'upcoming' end,hg,ag);
  else
   update public.tournament_matches set match_id=mid,opponent_name=case when is_own then v_opponent else (g->>'homeTeam')||' vs '||(g->>'awayTeam') end,kickoff_at=case when mid is null or m.status='upcoming' then kick else kickoff_at end,planned_minutes=greatest(1,least(120,coalesce((g->>'plannedMinutes')::integer,10))),pitch=g->>'pitch',group_label=g->>'groupLabel',phase=g->>'phase',sort_order=seq,home_team=g->>'homeTeam',away_team=g->>'awayTeam',is_own_team=is_own,source=case when is_own then 'spielzeitapp' else 'official' end,provider=p_analysis->>'provider',external_match_id=ext,official_status=case when hg is not null then 'finished' else 'upcoming' end,home_goals=hg,away_goals=ag where id=s.id;
  end if;
 end loop;
 update public.tournament_sync_state set source_url=p_url,own_team_name=own_name,analysis=p_analysis,synced_at=now(),last_error=null where event_id=p_event;
end $$;
revoke all on function tournament_sync.reconcile(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.apply_tournament_plan(p_event uuid,p_url text,p_analysis jsonb,p_own_team text default null) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 select team_season_id into sid from public.events where id=p_event and kind='tournament';
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(sid),false) then raise exception 'Trainerzugriff erforderlich' using errcode='42501'; end if;
 if p_own_team is not null then
  if not exists(select 1 from jsonb_array_elements(p_analysis->'teams') t where t->>'teamName'=p_own_team) then raise exception 'Mannschaft nicht im Plan'; end if;
  if exists(select 1 from public.tournament_sync_state where event_id=p_event and own_team_name is not null and own_team_name<>p_own_team) and exists(select 1 from public.tournament_matches where tournament_event_id=p_event and match_id is not null) then raise exception 'Mannschaft bereits mit Spielen verknüpft'; end if;
  insert into public.tournament_sync_state(event_id,source_url,own_team_name) values(p_event,p_url,p_own_team) on conflict(event_id) do update set own_team_name=excluded.own_team_name;
 end if;
 perform tournament_sync.reconcile(p_event,p_url,p_analysis);
end $$;
revoke all on function public.apply_tournament_plan(uuid,text,jsonb,text) from public,anon;
grant execute on function public.apply_tournament_plan(uuid,text,jsonb,text) to authenticated;

create function tournament_sync.queue_reminders() returns void language plpgsql security definer set search_path='' as $$
declare n record; k text;
begin
 update public.notification_jobs set status='pending' where status='failed' and attempt_count<3 and payload->>'automation'='tournament_next_match' and (payload->>'kickoff')::timestamptz>now();
 -- Cancel obsolete pending jobs after postponement, cancellation, start or changed pairing.
 update public.notification_jobs j set status='sent',last_error='Turniererinnerung ersetzt oder nicht mehr aktuell',sent_at=now() where j.payload->>'automation'='tournament_next_match' and j.status in ('pending','failed') and not exists(select 1 from public.tournament_matches s join public.matches m on m.id=s.match_id join public.events e on e.id=s.tournament_event_id where s.id::text=j.payload->>'slotId' and s.kickoff_at=(j.payload->>'kickoff')::timestamptz and s.opponent_name=j.payload->>'opponent' and m.status='upcoming' and s.official_status is distinct from 'finished' and s.kickoff_at>now() and e.tournament_completed_at is null and coalesce(e.status,'upcoming') not in ('cancelled','canceled','deleted','finished'));
 for n in select distinct on(s.tournament_event_id) s.*,ts.team_id from public.tournament_matches s join public.matches m on m.id=s.match_id join public.events e on e.id=s.tournament_event_id join public.team_seasons ts on ts.id=e.team_season_id where s.is_own_team and m.status='upcoming' and s.official_status is distinct from 'finished' and s.kickoff_at>now() and s.kickoff_at<now()+interval '1 day' and e.tournament_completed_at is null and coalesce(e.status,'upcoming') not in ('cancelled','canceled','deleted','finished') order by s.tournament_event_id,s.kickoff_at,s.id loop
  k:='tournament:'||n.id||':'||extract(epoch from n.kickoff_at)::bigint||':'||md5(n.opponent_name);
  insert into public.notification_jobs(event_id,team_id,kind,send_at,payload,status,dedupe_key)
   values(n.tournament_event_id,n.team_id,'event',greatest(now(),n.kickoff_at-interval '5 minutes'),jsonb_build_object('automation','tournament_next_match','slotId',n.id,'matchId',n.match_id,'kickoff',n.kickoff_at,'opponent',n.opponent_name,'pushTitle','Unser nächstes Turnierspiel','pushBody','Gegen '||n.opponent_name||' um '||to_char(n.kickoff_at at time zone 'Europe/Vienna','HH24:MI')||coalesce(' · '||n.pitch,'')||'. Jetzt zum Spielfeld!','linkPath','/app/events/'||n.tournament_event_id),'pending',k)
   on conflict(dedupe_key) do update set status='pending',send_at=excluded.send_at,payload=excluded.payload,sent_at=null,last_error=null where public.notification_jobs.status='sent' and public.notification_jobs.last_error='Turniererinnerung ersetzt oder nicht mehr aktuell';
 end loop;
end $$;
revoke all on function tournament_sync.queue_reminders() from public,anon,authenticated,service_role;

create function tournament_sync.tick() returns void language plpgsql security definer set search_path='' as $$
declare t record; r record; body jsonb; origin text; reminder_url text; rid bigint;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('tournament-sync-tick',0)) then return; end if;
 select c.origin,c.reminder_url into origin,reminder_url from tournament_sync.config c where singleton;
 if origin is null then return; end if;
 insert into tournament_sync.tasks(event_id,source_url)
 select e.id,e.official_tournament_url from public.events e join public.team_seasons ts on ts.id=e.team_season_id where e.kind='tournament' and ts.status='active' and e.tournament_completed_at is null and coalesce(e.status,'upcoming') not in ('cancelled','canceled','deleted','finished') and e.starts_at between now()-interval '18 hours' and now()+interval '14 days' and e.official_tournament_url ~ '^https://(www[.])?(meinturnierplan[.](de|com)|go[.]tournament-live[.]com|tournament-live[.]com|tournamentbase[.]com)/' on conflict(event_id) do update set source_url=excluded.source_url,request_id=case when tournament_sync.tasks.source_url<>excluded.source_url then null else tournament_sync.tasks.request_id end;
 for t in select * from tournament_sync.tasks where request_id is not null for update loop
  select * into r from net._http_response where id=t.request_id;
  if not found then
   if t.requested_at<now()-interval '2 minutes' then update tournament_sync.tasks set request_id=null,next_at=now()+interval '1 minute' where event_id=t.event_id; end if;
   continue;
  end if;
  begin
   if r.status_code is distinct from 200 or r.error_msg is not null or r.timed_out then raise exception 'Veranstalter momentan nicht erreichbar'; end if;
   body:=r.content::jsonb;
   if body->>'ok'<>'true' then raise exception 'Turnierplan konnte nicht gelesen werden'; end if;
   perform tournament_sync.reconcile(t.event_id,t.source_url,body->'analysis');
   update tournament_sync.tasks set request_id=null,next_at=now()+case when (select starts_at from public.events where id=t.event_id)>now()+interval '1 day' then interval '15 minutes' else interval '30 seconds' end where event_id=t.event_id;
  exception when others then
   insert into public.tournament_sync_state(event_id,source_url,last_error) values(t.event_id,t.source_url,left(sqlerrm,200)) on conflict(event_id) do update set last_error=excluded.last_error;
   update tournament_sync.tasks set request_id=null,next_at=now()+interval '1 minute' where event_id=t.event_id;
  end;
 end loop;
 for t in select q.* from tournament_sync.tasks q join public.events e on e.id=q.event_id where q.request_id is null and q.next_at<=now() and e.official_tournament_url=q.source_url and e.tournament_completed_at is null and e.starts_at between now()-interval '18 hours' and now()+interval '14 days' and coalesce(e.status,'upcoming') not in ('cancelled','canceled','deleted','finished') order by q.next_at limit 8 for update of q loop
  rid:=net.http_get(url:=origin||'/api/tournament-plan-analyze',params:=jsonb_build_object('url',t.source_url),timeout_milliseconds:=55000);
  update tournament_sync.tasks set request_id=rid,requested_at=now() where event_id=t.event_id;
 end loop;
 perform tournament_sync.queue_reminders();
 if exists(select 1 from public.notification_jobs where status='pending' and payload->>'automation'='tournament_next_match' and send_at<=now()) then
  perform net.http_post(url:=reminder_url,body:='{}'::jsonb,timeout_milliseconds:=20000);
 end if;
end $$;
revoke all on function tournament_sync.tick() from public,anon,authenticated,service_role;
create function tournament_sync.configure(p_origin text,p_reminder_url text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into tournament_sync.config values(true,p_origin,p_reminder_url) on conflict(singleton) do update set origin=excluded.origin,reminder_url=excluded.reminder_url;
 perform cron.schedule('tournament-plan-sync','* * * * *','select tournament_sync.tick();');
end $$;
revoke all on function tournament_sync.configure(text,text) from public,anon,authenticated,service_role;
select pg_notify('pgrst','reload schema');
