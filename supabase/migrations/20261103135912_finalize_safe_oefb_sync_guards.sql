create or replace function public.save_oefb_schedule_sync(p_season uuid,p_url text,p_team text,p_mode text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_season),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_season and ts.status='active' and c.status='active' for update of ts;
 if not found then raise exception 'Season is read-only'; end if;
 if p_enabled is null then raise exception 'Aktivierungsstatus fehlt'; end if;
 if not exists(select 1 from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id where ts.id=p_season and replace(ss.name,'/','-')=substring(p_url from 'Saison-([0-9]{4}-[0-9]{2})/')) then raise exception 'Spielplan gehört nicht zur gewählten Saison'; end if;
 if exists(select 1 from public.team_seasons ts where ts.id=p_season and nullif(trim(ts.age_group),'') is not null and lower(substring(p_url from '/([^/]+)/Spiele/?$')) !~ ('^'||lower(trim(ts.age_group))||'([_-]|$)')) then raise exception 'Spielplan gehört nicht zur gewählten Altersklasse'; end if;
 -- Schedule mode becomes the sole background source for this season.
 update public.team_seasons set oefb_auto_sync_enabled=false where id=p_season;

 insert into oefb_sync.schedules(team_season_id,source_url,team_name,mode,enabled) values(p_season,trim(p_url),trim(p_team),p_mode,p_enabled)
 on conflict(team_season_id) do update set source_url=excluded.source_url,team_name=excluded.team_name,mode=excluded.mode,enabled=excluded.enabled,next_at=now(),last_error=null;
end $$;
revoke all on function public.save_oefb_schedule_sync(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.save_oefb_schedule_sync(uuid,text,text,text,boolean) to authenticated;

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
   if m.status<>'finished' and (coalesce(m.score_home,0)<>0 or coalesce(m.score_away,0)<>0) then
    if sh is not null then update public.events set oefb_sync_conflict=jsonb_build_object('field','score','trainer',m.score_home||':'||m.score_away,'oefb',sh||':'||sa) where id=e.id; end if;
    continue;
   end if;
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
  if e.oefb_sync_conflict is not null then update public.events set oefb_sync_conflict=null where id=e.id; end if;
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


