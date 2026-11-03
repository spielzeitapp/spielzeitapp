-- Independent schedule source for teams without standings; all worker state is private.
create table oefb_sync.schedules (
 team_season_id uuid primary key references public.team_seasons(id) on delete cascade,
 source_url text not null check(source_url ~ '^https://vereine[.]oefb[.]at/[A-Za-z0-9_-]+/Mannschaften/Saison-[0-9]{4}-[0-9]{2}/[A-Za-z0-9_-]+/Spiele/?$'),
 team_name text not null check(length(trim(team_name)) between 2 and 120),
 mode text not null check(mode in ('schedule','results')),
 enabled boolean not null default false,
 next_at timestamptz not null default now(), last_success timestamptz,last_error text
);
alter table oefb_sync.schedules enable row level security;
revoke all on oefb_sync.schedules from public,anon,authenticated,service_role;
alter table public.events add column oefb_sync_conflict jsonb;

create function public.save_oefb_schedule_sync(p_season uuid,p_url text,p_team text,p_mode text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_season),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_season and ts.status='active' and c.status='active' for update of ts;
 if not found then raise exception 'Season is read-only'; end if;
 insert into oefb_sync.schedules(team_season_id,source_url,team_name,mode,enabled) values(p_season,trim(p_url),trim(p_team),p_mode,p_enabled)
 on conflict(team_season_id) do update set source_url=excluded.source_url,team_name=excluded.team_name,mode=excluded.mode,enabled=excluded.enabled,next_at=now(),last_error=null;
end $$;
revoke all on function public.save_oefb_schedule_sync(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.save_oefb_schedule_sync(uuid,text,text,text,boolean) to authenticated;

create function public.get_oefb_schedule_sync(p_season uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_season),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 return jsonb_build_object('settings',(select to_jsonb(s) from oefb_sync.schedules s where s.team_season_id=p_season),'conflicts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'opponent',opponent,'detail',oefb_sync_conflict)),'[]') from public.events where team_season_id=p_season and oefb_sync_conflict is not null));
end $$;
revoke all on function public.get_oefb_schedule_sync(uuid) from public,anon;
grant execute on function public.get_oefb_schedule_sync(uuid) to authenticated;
create or replace function oefb_sync.reconcile(p_team_season_id uuid,p_competition_id text,p_games jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare g jsonb; e public.events%rowtype; m public.matches%rowtype; source_id text; kick timestamptz; sh integer; sa integer; n integer:=0;
begin
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' and (ts.oefb_table_competition_id::text=p_competition_id or (p_competition_id='schedule:'||ts.id::text and exists(select 1 from oefb_sync.schedules ss where ss.team_season_id=ts.id))) for share of ts;
 if not found then raise exception 'Competition/season not writable' using errcode='42501'; end if;
 if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games)>500 then raise exception 'Invalid games'; end if;
 for g in select value from jsonb_array_elements(p_games) loop
  source_id:=g->>'id';
  if coalesce(source_id,'')!~ '^\d{1,10}$' or coalesce(g->>'kickoff','')!~ '^20\d\d-\d\d-\d\dT' then continue; end if;
  kick:=(g->>'kickoff')::timestamptz;
  sh:=null;sa:=null;
  if not exists(select 1 from oefb_sync.schedules ss where ss.team_season_id=p_team_season_id and ss.enabled and ss.mode='schedule') and g->>'status'='Endstand' and coalesce(g->>'score','')~ '^\d{1,2}:\d{1,2}$' and kick<now() then sh:=split_part(g->>'score',':',1)::integer;sa:=split_part(g->>'score',':',2)::integer; end if;
  select * into e from public.events where team_season_id=p_team_season_id and external_source='oefb' and external_id=source_id and kind='match' and lower(coalesce(status,'')) not in ('cancelled','canceled','deleted') and lower(coalesce(fixture_status,'')) not in ('cancelled','canceled','deleted') for update;
  if not found then continue; end if;
  -- A trainer's kickoff override wins over subsequent source refreshes.
  if e.source_starts_at is not null and e.starts_at is distinct from e.source_starts_at and e.starts_at is distinct from kick then
   update public.events set oefb_sync_conflict=jsonb_build_object('field','starts_at','trainer',e.starts_at,'oefb',kick) where id=e.id;
   continue;
  end if;
  if e.match_id is not null then
   select * into m from public.matches where id=e.match_id and team_season_id=p_team_season_id and live_started_at is null and coalesce(live_elapsed_seconds,0)=0 and not exists(select 1 from public.match_events me where me.match_id=e.match_id) for update;
   if not found then continue; end if;
   if m.status='finished' and (sh is null or m.score_home is distinct from sh or m.score_away is distinct from sa) then
    if sh is not null then update public.events set oefb_sync_conflict=jsonb_build_object('field','score','trainer',m.score_home||':'||m.score_away,'oefb',sh||':'||sa) where id=e.id; end if;
    continue;
   end if;
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
   update public.events set starts_at=kick,source_starts_at=kick,status=case when sh is not null then 'finished' else status end where id=e.id;
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


create function oefb_sync.consume_schedule(p_season uuid,p_body jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare cfg oefb_sync.schedules%rowtype; f jsonb; games jsonb:='[]'; eid uuid; comp text; kick timestamptz;
begin
 select * into strict cfg from oefb_sync.schedules where team_season_id=p_season and enabled for update;
 if p_body->>'ok' is distinct from 'true' or p_body->>'sourceUrl' is distinct from cfg.source_url or jsonb_typeof(p_body->'fixtures') is distinct from 'array' or jsonb_array_length(p_body->'fixtures')>500 then raise exception 'Invalid schedule response'; end if;
 select coalesce(oefb_table_competition_id,'schedule:'||id::text) into comp from public.team_seasons where id=p_season;
 for f in select value from jsonb_array_elements(p_body->'fixtures') loop
  if coalesce(f->>'external_id','') !~ '^[0-9]{1,10}$' or coalesce(f->>'starts_at','') !~ '^20[0-9]{2}-' or nullif(f->>'opponent','') is null then continue; end if;
  -- Do not guess which side is ours if the saved name does not occur exactly.
  if lower(trim(cfg.team_name)) not in (lower(trim(f->>'heim_name')),lower(trim(f->>'gast_name'))) then raise exception 'Mannschaftsname stimmt nicht mit ÖFB-Spielplan überein'; end if;
  kick:=(f->>'starts_at')::timestamptz;
  perform pg_advisory_xact_lock(hashtextextended(p_season::text||':'||(f->>'external_id'),0));
  select id into eid from public.events where team_season_id=p_season and external_source='oefb' and external_id=f->>'external_id';
  if not found then
   -- Preserve manually created duplicates; staff can link them in the existing import preview.
   if exists(select 1 from public.events where team_season_id=p_season and kind='match' and lower(trim(opponent))=lower(trim(f->>'opponent')) and abs(extract(epoch from(starts_at-kick)))<86400) then continue; end if;
   insert into public.events(team_season_id,kind,type,match_type,opponent,is_home,location,starts_at,source_starts_at,status,attendance_mode,external_source,external_id,external_url,competition,fixture_status,opponent_logo_url)
   values(p_season,'match','game',case when lower(f->>'art') in ('testspiel','freundschaftsspiel') then 'friendly' else 'league' end,f->>'opponent',lower(trim(f->>'heim_name'))=lower(trim(cfg.team_name)),f->>'location',kick,kick,'upcoming','opt_in','oefb',f->>'external_id',f->>'external_url',f->>'competition','open',f->>'opponent_logo_url');
  end if;
  games:=games||jsonb_build_array(jsonb_build_object('id',f->>'external_id','kickoff',f->>'starts_at','score',case when cfg.mode='results' and f->>'score_home' ~ '^[0-9]{1,2}$' and f->>'score_away' ~ '^[0-9]{1,2}$' then (f->>'score_home')||':'||(f->>'score_away') end,'status','Endstand'));
 end loop;
 perform oefb_sync.reconcile(p_season,comp,games);
 update oefb_sync.schedules set last_success=now(),last_error=null,next_at=now()+interval '15 minutes' where team_season_id=p_season;
end $$;
revoke all on function oefb_sync.consume_schedule(uuid,jsonb) from public,anon,authenticated,service_role;

create function oefb_sync.tick_schedule() returns void language plpgsql security definer set search_path='' as $$
declare cfg record; response record; origin text;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('oefb-schedule-sync',0)) then return; end if;
 select c.origin into origin from oefb_sync.config c where singleton;
 if origin is null then return; end if;
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','15000');
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','4000');
 for cfg in select s.* from oefb_sync.schedules s join public.team_seasons ts on ts.id=s.team_season_id join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where s.enabled and s.next_at<=now() and ts.status='active' and c.status='active' order by s.next_at limit 2 for update of s loop
  begin
   select * into response from extensions.http_get(origin||'/api/oefb/schedule?url='||extensions.urlencode(cfg.source_url)||'&ourTeam='||extensions.urlencode(cfg.team_name));
   if response.status<>200 then raise exception 'ÖFB HTTP %',response.status; end if;
   perform oefb_sync.consume_schedule(cfg.team_season_id,response.content::jsonb);
  exception when others then
   update oefb_sync.schedules set last_error=left(sqlerrm,300),next_at=now()+interval '5 minutes' where team_season_id=cfg.team_season_id;
  end;
 end loop;
end $$;
revoke all on function oefb_sync.tick_schedule() from public,anon,authenticated,service_role;
-- Activate separately in TEST, never implicitly for another environment.
