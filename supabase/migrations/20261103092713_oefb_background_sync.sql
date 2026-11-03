-- Only pg_cron/database owner can dispatch or consume trusted HTTP responses.
create schema if not exists oefb_sync;
revoke all on schema oefb_sync from public, anon, authenticated, service_role;

-- Automatic source confirmations must not impersonate a human administrator.
alter table h2h_private.result_confirmations add column confirmation_source text not null default 'manual';
alter table h2h_private.result_confirmations alter column confirmed_by drop not null;
alter table h2h_private.result_confirmations add constraint result_confirmation_actor
 check (confirmation_source in ('manual','oefb') and (confirmed_by is not null or confirmation_source='oefb'));

create table oefb_sync.config (
 singleton boolean primary key default true check(singleton),
 origin text not null check(origin in ('https://app.spielzeitapp.at','https://spielzeitapp.at'))
);
create table oefb_sync.tasks (
 competition_id text not null check(competition_id ~ '^[0-9]{1,10}$'),
 round_id integer not null check(round_id between 0 and 100),
 next_at timestamptz not null default now(),
 request_id bigint,
 requested_at timestamptz,
 last_success timestamptz,
 last_error text,
 updated_count integer not null default 0,
 primary key(competition_id,round_id)
);
alter table oefb_sync.config enable row level security;
alter table oefb_sync.tasks enable row level security;
revoke all on all tables in schema oefb_sync from public,anon,authenticated,service_role;

-- Make fresh results visible to fans even if no trainer opens Home.
create function oefb_sync.ensure_result_post(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype; m public.matches%rowtype; team record; own_name text; outcome text; post_data jsonb;
begin
 select * into e from public.events where id=p_event_id;
 if not found or e.is_home is null or e.match_id is null then return; end if;
 select * into m from public.matches where id=e.match_id and status='finished';
 if not found then return; end if;
 if exists(select 1 from public.team_feed_dedupe_suppressions where dedupe_key='result_feed:'||m.id) then return; end if;
 select ts.team_id,ts.display_name,t.name,c.logo_url into team from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=e.team_season_id;
 own_name:=coalesce(nullif(team.display_name,''),team.name,'Unser Team');
 outcome:=case when m.score_home=m.score_away then 'draw' when (m.score_home>m.score_away)=e.is_home then 'win' else 'loss' end;
 post_data:=jsonb_build_object('match_id',m.id,'event_id',e.id,'team_season_id',e.team_season_id,
 'home_team_name',case when e.is_home then own_name else e.opponent end,
 'away_team_name',case when e.is_home then e.opponent else own_name end,
 'home_logo_url',coalesce(case when e.is_home then team.logo_url else e.opponent_logo_url end,''),
 'away_logo_url',coalesce(case when e.is_home then e.opponent_logo_url else team.logo_url end,''),
 'home_score',m.score_home,'away_score',m.score_away,'match_type',e.match_type,
 'starts_at',e.starts_at,'meeting_at',e.meeting_at,'location',coalesce(e.location,''),
 'scorers','[]'::jsonb,'period_scores',m.period_scores,'result_state',outcome,
 'our_team_name',own_name,'is_home',e.is_home,'deep_link','/app/events/'||e.id,'source','oefb');
 insert into public.team_feed_posts(team_season_id,team_id,event_id,post_kind,caption,payload,dedupe_key,media_type,created_by)
 values(e.team_season_id,team.team_id,e.id,'result_auto',
 '⚽ ENDSTAND! '||case when e.is_home then own_name else e.opponent end||' '||m.score_home||':'||m.score_away||' '||case when e.is_home then e.opponent else own_name end,
 post_data,'result_feed:'||m.id,'result',null)
 on conflict(dedupe_key) do update set payload=public.team_feed_posts.payload||jsonb_build_object('starts_at',e.starts_at),updated_at=now()
 where public.team_feed_posts.payload->>'starts_at' is distinct from post_data->>'starts_at';
end $$;
revoke all on function oefb_sync.ensure_result_post(uuid) from public,anon,authenticated,service_role;

create or replace function oefb_sync.reconcile(p_team_season_id uuid,p_competition_id text,p_games jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare g jsonb; e public.events%rowtype; m public.matches%rowtype; source_id text; kick timestamptz; sh integer; sa integer; n integer:=0;
begin
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' and ts.oefb_table_competition_id::text=p_competition_id for share of ts;
 if not found then raise exception 'Competition/season not writable' using errcode='42501'; end if;
 if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games)>500 then raise exception 'Invalid games'; end if;
 for g in select value from jsonb_array_elements(p_games) loop
  source_id:=g->>'id';
  if coalesce(source_id,'')!~ '^\d{1,10}$' or coalesce(g->>'kickoff','')!~ '^20\d\d-\d\d-\d\dT' then continue; end if;
  kick:=(g->>'kickoff')::timestamptz;
  sh:=null;sa:=null;
  if g->>'status'='Endstand' and coalesce(g->>'score','')~ '^\d{1,2}:\d{1,2}$' and kick<now() then sh:=split_part(g->>'score',':',1)::integer;sa:=split_part(g->>'score',':',2)::integer; end if;
  select * into e from public.events where team_season_id=p_team_season_id and external_source='oefb' and external_id=source_id and kind='match' and lower(coalesce(status,'')) not in ('cancelled','canceled','deleted') and lower(coalesce(fixture_status,'')) not in ('cancelled','canceled','deleted') for update;
  if not found then continue; end if;
  if e.match_id is not null then
   select * into m from public.matches where id=e.match_id and team_season_id=p_team_season_id and live_started_at is null and coalesce(live_elapsed_seconds,0)=0 and not exists(select 1 from public.match_events me where me.match_id=e.match_id) for update;
   if not found or (m.status='finished' and (sh is null or m.score_home is distinct from sh or m.score_away is distinct from sa)) then continue; end if;
   update public.matches set match_date=kick,score_home=coalesce(sh,score_home),score_away=coalesce(sa,score_away),status=case when sh is not null then 'finished' else status end where id=e.match_id and (match_date is distinct from kick or (sh is not null and (status is distinct from 'finished' or score_home is distinct from sh or score_away is distinct from sa)));
  elsif sh is not null then
   -- Match the result import safeguards, using the newly supplied kickoff.
   if e.is_home is null or e.match_type not in ('league','friendly') or lower(coalesce(e.fixture_status,'')) in ('cancelled','canceled','deleted') then continue; end if;
   insert into public.matches(team_season_id,opponent,match_date,location,status,score_home,score_away,motm_enabled,auto_matchday_feed_enabled)
    values(p_team_season_id,e.opponent,kick,e.location,'finished',sh,sa,false,false) returning * into m;
   update public.events set match_id=m.id,fixture_status='published' where id=e.id;
   insert into h2h_private.result_confirmations(match_id,score_home,score_away,team_score_home,confirmed_by,confirmation_source)
    values(m.id,sh,sa,e.is_home,auth.uid(),'oefb');
  end if;
  if e.starts_at is distinct from kick or (sh is not null and e.status is distinct from 'finished') then
   update public.events set starts_at=kick,status=case when sh is not null then 'finished' else status end where id=e.id;
   n:=n+1;
  end if;
  if sh is not null then perform oefb_sync.ensure_result_post(e.id); end if;
 end loop;
 return n;
end $$;

revoke all on function oefb_sync.reconcile(uuid,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.sync_oefb_competition_fixtures(p_team_season_id uuid,p_competition_id text,p_games jsonb)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then
  raise exception 'Trainer access required' using errcode='42501';
 end if;
 return oefb_sync.reconcile(p_team_season_id,p_competition_id,p_games);
end $$;
revoke all on function public.sync_oefb_competition_fixtures(uuid,text,jsonb) from public,anon;
grant execute on function public.sync_oefb_competition_fixtures(uuid,text,jsonb) to authenticated;

-- Each minute: consume completed responses, then dispatch at most four requests.
-- Every round refreshes after 15 minutes; failures retry after five minutes.
create function oefb_sync.tick() returns void language plpgsql security definer set search_path='' as $$
declare task record; response record; sid uuid; body jsonb; games jsonb; round_row jsonb;
 base_url text; changed integer; new_request bigint;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('oefb-background-sync',0)) then return; end if;
 select origin into base_url from oefb_sync.config where singleton;
 if base_url is null then return; end if;
 insert into oefb_sync.tasks(competition_id,round_id)
 select distinct ts.oefb_table_competition_id,0
 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
 where ts.status='active' and c.status='active' and ts.oefb_table_competition_id ~ '^[0-9]{1,10}$'
 on conflict do nothing;

 for task in select * from oefb_sync.tasks where request_id is not null order by requested_at limit 20 for update loop
  select * into response from net._http_response where id=task.request_id;
  if not found then
   if task.requested_at < now()-interval '2 minutes' then
    update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error='HTTP response missing or timed out' where competition_id=task.competition_id and round_id=task.round_id;
   end if;
   continue;
  end if;
  begin
   if response.status_code is distinct from 200 or coalesce(response.timed_out,false) or response.error_msg is not null then raise exception 'Upstream HTTP %',response.status_code; end if;
   body:=response.content::jsonb;
   if jsonb_typeof(body->'games') is distinct from 'array' or jsonb_array_length(body->'games')>500 or (body->>'round')::integer is distinct from task.round_id then raise exception 'Invalid source response'; end if;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',substring(g->>'sourceUrl' from '^https://(?:www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/([0-9]{1,10})/'),
    'kickoff',g->>'kickoff','score',g->>'score','status',g->>'status')), '[]'::jsonb) into games
   from jsonb_array_elements(body->'games') g
   where g->>'sourceUrl' ~ '^https://(www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/[0-9]{1,10}/';
   changed:=0;
   for sid in select ts.id from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
    where ts.status='active' and c.status='active' and ts.oefb_table_competition_id=task.competition_id loop
    changed:=changed+oefb_sync.reconcile(sid,task.competition_id,games);
   end loop;
   if task.round_id=0 then
    if jsonb_typeof(body->'rounds') is distinct from 'array' or jsonb_array_length(body->'rounds')>101 then raise exception 'Invalid rounds'; end if;
    for round_row in select value from jsonb_array_elements(body->'rounds') loop
     if round_row->>'id' ~ '^[0-9]{1,3}$' and (round_row->>'id')::integer between 1 and 100 then
      insert into oefb_sync.tasks(competition_id,round_id) values(task.competition_id,(round_row->>'id')::integer) on conflict do nothing;
     end if;
    end loop;
   end if;
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '15 minutes',last_success=now(),last_error=null,updated_count=changed where competition_id=task.competition_id and round_id=task.round_id;
  exception when others then
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error=left(sqlerrm,300) where competition_id=task.competition_id and round_id=task.round_id;
  end;
 end loop;

 for task in select q.* from oefb_sync.tasks q where q.request_id is null and q.next_at<=now()
 and exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.status='active' and c.status='active' and ts.oefb_table_competition_id=q.competition_id)
 order by q.next_at,q.competition_id,q.round_id limit 4 for update loop
  new_request:=net.http_get(url:=base_url||'/api/oefb/table',params:=jsonb_build_object('view','results','id',task.competition_id,'round',task.round_id),timeout_milliseconds:=20000);
  update oefb_sync.tasks set request_id=new_request,requested_at=now() where competition_id=task.competition_id and round_id=task.round_id;
 end loop;
end $$;
revoke all on function oefb_sync.tick() from public,anon,authenticated,service_role;

-- No scheduler is activated by the migration: each environment is enabled separately.
create function oefb_sync.configure(p_origin text) returns bigint language plpgsql security definer set search_path='' as $$
declare jid bigint;
begin
 insert into oefb_sync.config(singleton,origin) values(true,p_origin) on conflict(singleton) do update set origin=excluded.origin;
 select cron.schedule('oefb-fixture-sync','* * * * *','select oefb_sync.tick();') into jid;
 return jid;
end $$;
revoke all on function oefb_sync.configure(text) from public,anon,authenticated,service_role;
