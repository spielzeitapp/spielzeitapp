-- Environment-neutral definitions. The owner enables the scheduler separately in TEST.
create schema season_lifecycle;
revoke all on schema season_lifecycle from public,anon,authenticated,service_role;
create table season_lifecycle.plans (
 source_id uuid primary key references public.team_seasons(id) on delete cascade,
 target_id uuid references public.team_seasons(id) on delete set null,
 snoozed_until timestamptz,
 confirmed_at timestamptz,
 confirmed_by uuid references auth.users(id),
 checked_at timestamptz not null default now(),
 last_error text
);
alter table season_lifecycle.plans enable row level security;
revoke all on season_lifecycle.plans from public,anon,authenticated,service_role;

create unique index season_lifecycle_single_draft_source on public.team_seasons(prepared_from_team_season_id) where prepared_from_team_season_id is not null and status='draft';

create function season_lifecycle.authorized(p_source uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
  where ts.id=p_source and c.status='active' and (public.is_platform_admin() or public.is_club_admin_for_club(t.club_id) or public.membership_is_staff_for_team_season(ts.id))
 );
$$;

create function season_lifecycle.snapshot(p_source uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s record; total_games int; open_games int; running int; last_game timestamptz; next_year int; fingerprint text; roster jsonb; target record;
begin
 select ts.*,ss.name season_name,t.name team_name,t.club_id,c.name club_name into s from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_source;
 if not found then raise exception 'Saison nicht gefunden'; end if;
 next_year:=case when s.season_name ~ '^20[0-9]{2}/[0-9]{2}$' and (right(s.season_name,2)::int=(left(s.season_name,4)::int+1)%100) then left(s.season_name,4)::int+1 end;
 select count(*),count(*) filter(where e.status not in ('finished','canceled') or coalesce(m.live_is_running,false) or m.status='live'),max(e.starts_at) filter(where e.status<>'canceled') into total_games,open_games,last_game
 from public.events e left join public.matches m on m.id=e.match_id where e.team_season_id=p_source and (e.kind in ('match','tournament') or e.type in ('game','match','tournament')) and coalesce(e.match_type,'league') not in ('friendly','test','testspiel');
 select count(*) into running from public.matches where team_season_id=p_source and (status='live' or coalesce(live_is_running,false));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',concat_ws(' ',p.first_name,p.last_name),'number',coalesce(r.jersey_number,p.jersey_number,p.number),'roster_status',coalesce(r.status::text,p.status::text,'active')) order by p.last_name,p.first_name),'[]') into roster
 from public.players p left join public.team_season_players r on r.player_id=p.id and r.team_season_id=p_source
 where p.id in (
  select rr.player_id from public.team_season_players rr where rr.team_season_id=p_source and rr.status<>'archived' and rr.left_at is null
  union select pp.id from public.players pp where pp.team_season_id=p_source and coalesce(pp.status,'active')<>'archived' and not exists(select 1 from public.team_season_players rr where rr.team_season_id=p_source and rr.player_id=pp.id)
 );
 select ts.id,ts.status,ss.name season_name,ts.age_group into target from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id
 where ts.prepared_from_team_season_id=p_source order by (ts.status='draft') desc,ts.created_at desc limit 1;
 select md5(coalesce((select jsonb_agg(jsonb_build_array(e.id,e.updated_at,e.status,e.starts_at,e.match_id,m.status,m.live_is_running,m.score_home,m.score_away) order by e.id)::text from public.events e left join public.matches m on m.id=e.match_id where e.team_season_id=p_source),'[]')||roster::text||s.status||coalesce(target.id::text,'')||coalesce(target.status,'')) into fingerprint;
 return jsonb_build_object('source_id',p_source,'team_id',s.team_id,'club_name',s.club_name,'team_name',s.team_name,'season_name',s.season_name,'status',s.status,'age_group',s.age_group,
  'next_season_name',case when next_year is not null then next_year::text||'/'||lpad(((next_year+1)%100)::text,2,'0') end,
  'next_age_group',case when s.age_group ~* '^U[0-9]{1,2}$' and substring(s.age_group from '[0-9]+')::int<23 then 'U'||(substring(s.age_group from '[0-9]+')::int+1)::text else s.age_group end,
  'target_id',target.id,'target_status',target.status,'target_season_name',target.season_name,'target_age_group',target.age_group,
  'known_games',total_games,'open_games',open_games,'running_games',running,'last_game_at',last_game,'roster',roster,'fingerprint',fingerprint,
  'possible_end',s.status='active' and total_games>0 and open_games=0 and running=0 and last_game<=now() and next_year is not null and last_game>=make_timestamptz(next_year,4,1,0,0,0,'Europe/Vienna'),
  'snoozed_until',(select snoozed_until from season_lifecycle.plans where source_id=p_source));
end $$;

create function season_lifecycle.prepare(p_source uuid,p_name text default null,p_age text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare s record; next_name text; next_age text; sid uuid; target uuid; expected text; url text;
begin
 select ts.*,ss.name season_name,t.name team_name into s from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_source and c.status='active' for update of ts;
 if not found then raise exception 'Saison nicht gefunden'; end if;
 if s.season_name !~ '^20[0-9]{2}/[0-9]{2}$' or right(s.season_name,2)::int<>(left(s.season_name,4)::int+1)%100 then raise exception 'Saisonname muss z. B. 2026/27 sein'; end if;
 expected:=(left(s.season_name,4)::int+1)::text||'/'||lpad(((left(s.season_name,4)::int+2)%100)::text,2,'0');
 next_name:=coalesce(nullif(trim(p_name),''),expected);
 if next_name<>expected then raise exception 'Nur die direkte Folgesaison kann vorbereitet werden'; end if;
 next_age:=coalesce(nullif(trim(p_age),''),case when s.age_group ~* '^U[0-9]{1,2}$' and substring(s.age_group from '[0-9]+')::int<23 then 'U'||(substring(s.age_group from '[0-9]+')::int+1)::text else s.age_group end);
 if next_age is not null and (length(next_age)>30 or next_age !~ '^[A-Za-z0-9 _/-]+$') then raise exception 'Altersklasse ungültig'; end if;
 -- Also serialize different teams resolving the same catalog season.
 perform pg_advisory_xact_lock(hashtextextended('season-catalog:'||next_name,0));
 select id into sid from public.seasons where name=next_name order by created_at,id limit 1;
 if sid is null then insert into public.seasons(name,active) values(next_name,false) returning id into sid; end if;
 select id into target from public.team_seasons where team_id=s.team_id and season_id=sid for update;
 if target is null then
  insert into public.team_seasons(team_id,season_id,status,prepared_from_team_season_id,display_name,age_group,photo_layout_default,oefb_duration_default_minutes)
  values(s.team_id,sid,'draft',p_source,concat_ws(' · ',s.team_name,next_age,next_name),next_age,s.photo_layout_default,s.oefb_duration_default_minutes) returning id into target;
 elsif not exists(select 1 from public.team_seasons where id=target and status='draft' and prepared_from_team_season_id=p_source) then
  raise exception 'Folgesaison bereits vorhanden; vorhandene Zuordnung prüfen';
 end if;
 -- Existing staff keep access to their draft. Families/fans are never granted new staff roles.
 insert into public.memberships(user_id,team_season_id,role,photo_layout)
 select user_id,target,role,photo_layout from public.memberships where team_season_id=p_source and role::text in ('trainer','head_coach','co_trainer') on conflict(user_id,team_season_id) do nothing;
 insert into season_lifecycle.plans(source_id,target_id,checked_at) values(p_source,target,now()) on conflict(source_id) do update set target_id=excluded.target_id,checked_at=now(),last_error=null;
 -- Copy a proposal only. New season URLs stay disabled until the season is explicitly started.
 select replace(source_url,'Saison-'||replace(s.season_name,'/','-')||'/','Saison-'||replace(next_name,'/','-')||'/') into url from oefb_sync.schedules where team_season_id=p_source;
 if url is not null then
  url:=regexp_replace(url,'/[^/]+/Spiele/?$','/'||coalesce(next_age,s.age_group)||'/Spiele');
  insert into oefb_sync.schedules(team_season_id,source_url,team_name,mode,enabled)
  select target,url,team_name,mode,false from oefb_sync.schedules where team_season_id=p_source on conflict(team_season_id) do nothing;
 end if;
 return target;
end $$;

create function public.get_season_lifecycle(p_source uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare output jsonb;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 if p_source is not null then
  if not season_lifecycle.authorized(p_source) then raise exception 'Keine Saisonberechtigung' using errcode='42501'; end if;
  return jsonb_build_array(season_lifecycle.snapshot(p_source));
 end if;
 select coalesce(jsonb_agg((season_lifecycle.snapshot(ts.id)-'roster') order by c.name,t.name),'[]') into output
 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
 where ts.status='active' and c.status='active' and season_lifecycle.authorized(ts.id);
 return output;
end $$;

create function public.prepare_season_lifecycle(p_source uuid,p_name text default null,p_age text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not season_lifecycle.authorized(p_source) then raise exception 'Keine Saisonberechtigung' using errcode='42501'; end if;
 perform season_lifecycle.prepare(p_source,p_name,p_age);
 return season_lifecycle.snapshot(p_source);
end $$;

create function public.snooze_season_lifecycle(p_source uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not season_lifecycle.authorized(p_source) then raise exception 'Keine Saisonberechtigung' using errcode='42501'; end if;
 insert into season_lifecycle.plans(source_id,snoozed_until) values(p_source,now()+interval '7 days') on conflict(source_id) do update set snoozed_until=excluded.snoozed_until;
end $$;

create function public.finish_season_lifecycle(p_source uuid,p_target uuid,p_fingerprint text,p_confirm boolean,p_activate boolean default false,p_players uuid[] default null,p_age text default null,p_enable_sync boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.team_seasons%rowtype; dest public.team_seasons%rowtype; snap jsonb; eligible uuid[]; row_data record;
begin
 if not season_lifecycle.authorized(p_source) then raise exception 'Keine Saisonberechtigung' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'Spielplan, Nachträge und Mannschaftszuordnung bitte bestätigen'; end if;
 select * into s from public.team_seasons where id=p_source for update;
 select * into dest from public.team_seasons where id=p_target for update;
 if dest.id is null or dest.prepared_from_team_season_id is distinct from p_source or dest.team_id<>s.team_id then raise exception 'Zielsaison gehört nicht zur Mannschaft'; end if;
 if exists(select 1 from season_lifecycle.plans where source_id=p_source and target_id=p_target and confirmed_at is not null) and s.status='archived' and ((not p_activate and dest.status='draft') or (p_activate and dest.status='active')) then return season_lifecycle.snapshot(p_source); end if;
 if not exists(select 1 from public.seasons a join public.seasons b on b.id=dest.season_id where a.id=s.season_id and a.name ~ '^20[0-9]{2}/[0-9]{2}$' and b.name=(left(a.name,4)::int+1)::text||'/'||lpad(((left(a.name,4)::int+2)%100)::text,2,'0')) then raise exception 'Ziel ist nicht die direkte Folgesaison'; end if;
 if dest.status<>'draft' or s.status not in ('active','archived') then raise exception 'Saisonstatus hat sich geändert'; end if;
 snap:=season_lifecycle.snapshot(p_source);
 if p_fingerprint is distinct from snap->>'fingerprint' then raise exception 'Saisonstand geändert. Bitte erneut prüfen.' using errcode='40001'; end if;
 if (snap->>'open_games')::int>0 or (snap->>'running_games')::int>0 then raise exception 'Offene Pflichtspiele oder ein laufendes Live-Spiel verhindern den Abschluss'; end if;
 if exists(select 1 from public.events where team_season_id=p_source and status not in ('finished','canceled') and starts_at>=now()) then raise exception 'Zukünftige Termine zuerst in der Saisonverwaltung prüfen oder zuordnen'; end if;
 if p_activate and exists(select 1 from public.team_seasons where team_id=s.team_id and status='active' and id not in (p_source,p_target)) then raise exception 'Andere aktive Saison vorhanden'; end if;
 if p_age is not null then
  if length(trim(p_age)) not between 1 and 30 or p_age !~ '^[A-Za-z0-9 _/-]+$' then raise exception 'Altersklasse ungültig'; end if;
  update public.team_seasons set age_group=trim(p_age),display_name=concat_ws(' · ',(select name from public.teams where id=s.team_id),trim(p_age),(select name from public.seasons where id=dest.season_id)) where id=p_target;
 end if;
 select coalesce(array_agg((r->>'id')::uuid),'{}') into eligible from jsonb_array_elements(snap->'roster') r;
 if p_players is not null and exists(select 1 from unnest(p_players) x where not(x=any(eligible))) then raise exception 'Kaderauswahl ist nicht mehr aktuell'; end if;
 eligible:=coalesce(p_players,eligible);
 insert into public.team_season_players(player_id,team_season_id,jersey_number,position,status,is_active,is_laz_player,photo_layout)
 select p.id,p_target,coalesce(r.jersey_number,p.jersey_number,p.number),coalesce(r.position,p.position),case when coalesce(r.status::text,p.status::text)='paused' or coalesce(r.is_active,p.is_active,true)=false then 'paused' else 'active' end,case when coalesce(r.status::text,p.status::text)='paused' then false else coalesce(r.is_active,p.is_active,true) end,coalesce(r.is_laz_player,p.is_laz_player,false),r.photo_layout
 from public.players p left join public.team_season_players r on r.player_id=p.id and r.team_season_id=p_source where p.id=any(eligible)
 on conflict(player_id,team_season_id) do nothing;
 insert into public.memberships(user_id,team_season_id,role,photo_layout)
 select m.user_id,p_target,m.role,m.photo_layout from public.memberships m where m.team_season_id=p_source and (m.role::text in ('trainer','head_coach','co_trainer') or m.role::text='parent' and exists(select 1 from public.player_guardians pg where pg.user_id=m.user_id and pg.player_id=any(eligible)) or m.role::text='player' and exists(select 1 from public.player_users pu where pu.user_id=m.user_id and pu.player_id=any(eligible))) on conflict(user_id,team_season_id) do nothing;
 insert into public.team_photos(team_season_id,photo_url,photo_zoom,photo_position_x,photo_position_y,photo_brightness)
 select p_target,photo_url,photo_zoom,photo_position_x,photo_position_y,photo_brightness from public.team_photos where team_season_id=p_source on conflict(team_season_id) do nothing;
 -- Copy all existing notification preferences without overwriting a prepared target.
 select * into row_data from public.team_notification_settings where team_season_id=p_source;
 if found and not exists(select 1 from public.team_notification_settings where team_season_id=p_target) then
  insert into public.team_notification_settings select (jsonb_populate_record(null::public.team_notification_settings,to_jsonb(row_data)||jsonb_build_object('id',gen_random_uuid(),'team_season_id',p_target,'created_at',now(),'updated_at',now()))).*;
 end if;
 insert into public.team_season_aliases(team_season_id,alias) select p_target,a.alias from public.team_season_aliases a where a.team_season_id=p_source and not exists(select 1 from public.team_season_aliases b where b.team_season_id=p_target and b.alias=a.alias);
 update public.notification_jobs set status='failed',last_error='season_archived',updated_at=now() where status='pending' and event_id in(select id from public.events where team_season_id=p_source);
 update public.team_seasons set status='archived',archived_at=coalesce(archived_at,now()),completed_at=coalesce(completed_at,now()),completed_by=coalesce(completed_by,auth.uid()),oefb_auto_sync_enabled=false where id=p_source;
 update oefb_sync.schedules set enabled=false where team_season_id=p_source;
 if p_activate then
  update public.team_seasons set status='active',archived_at=null where id=p_target;
  update public.players set team_season_id=p_target where id=any(eligible) and team_season_id=p_source;
  if p_enable_sync then
   update oefb_sync.schedules cfg set enabled=true,next_at=now() from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id
   where cfg.team_season_id=p_target and ts.id=p_target and replace(ss.name,'/','-')=substring(cfg.source_url from 'Saison-([0-9]{4}-[0-9]{2})/') and lower(substring(cfg.source_url from '/([^/]+)/Spiele/?$'))=lower(ts.age_group);
  end if;
 end if;
 insert into season_lifecycle.plans(source_id,target_id,confirmed_at,confirmed_by) values(p_source,p_target,now(),auth.uid()) on conflict(source_id) do update set target_id=p_target,confirmed_at=now(),confirmed_by=auth.uid(),snoozed_until=null;
 return season_lifecycle.snapshot(p_source);
end $$;

-- Date-routing RPC: used before saving manual games and importing a new ÖFB season.
create function public.resolve_event_team_season(p_source uuid,p_date timestamptz default null,p_name text default null,p_age text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s record; target uuid; desired text; year int;
begin
 if not season_lifecycle.authorized(p_source) then raise exception 'Keine Saisonberechtigung' using errcode='42501'; end if;
 select ts.status,ss.name into s from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id where ts.id=p_source;
 if s.name !~ '^20[0-9]{2}/[0-9]{2}$' then raise exception 'Saisonname zuerst in der Saisonverwaltung prüfen'; end if;
 year:=left(s.name,4)::int;
 desired:=coalesce(p_name,case when p_date>=(make_timestamptz(year+1,7,1,0,0,0,'Europe/Vienna')) and p_date<make_timestamptz(year+2,7,1,0,0,0,'Europe/Vienna') then (year+1)::text||'/'||lpad(((year+2)%100)::text,2,'0') else s.name end);
 if desired=s.name then
  if s.status='archived' then raise exception 'Abgeschlossene Saison ist schreibgeschützt'; end if;
  return jsonb_build_object('team_season_id',p_source,'prepared',false,'season_name',s.name);
 end if;
 target:=season_lifecycle.prepare(p_source,desired,p_age);
 return jsonb_build_object('team_season_id',target,'prepared',true,'season_name',desired);
end $$;

-- Prevent the final match and an event edit from racing the archive confirmation.
create function season_lifecycle.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
declare s record; year int; event_date timestamptz;
begin
 if new.team_season_id is null then return new; end if;
 select ts.status,ss.name into s from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id where ts.id=new.team_season_id for share of ts;
 if s.status='archived' then raise exception 'Abgeschlossene Saison ist schreibgeschützt'; end if;
 event_date:=case when tg_table_name='events' then (to_jsonb(new)->>'starts_at')::timestamptz else (to_jsonb(new)->>'match_date')::timestamptz end;
 if s.name ~ '^20[0-9]{2}/[0-9]{2}$' and event_date is not null then
  year:=left(s.name,4)::int;
  if event_date<make_timestamptz(year,7,1,0,0,0,'Europe/Vienna') or event_date>=make_timestamptz(year+1,7,1,0,0,0,'Europe/Vienna') then raise exception 'Termin gehört zu einer anderen Saison. Bitte zuerst die Folgesaison vorbereiten.'; end if;
 end if;
 return new;
end $$;
create trigger season_lifecycle_event_guard before insert or update of team_season_id,starts_at,status on public.events for each row execute function season_lifecycle.guard_event();
create trigger season_lifecycle_match_guard before insert or update of team_season_id,match_date,status,live_is_running on public.matches for each row execute function season_lifecycle.guard_event();

create function season_lifecycle.tick() returns integer language plpgsql security definer set search_path='' as $$
declare s record; count_prepared int:=0;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('season-lifecycle-tick',0)) then return 0; end if;
 for s in select ts.id,ss.name from public.team_seasons ts join public.seasons ss on ss.id=ts.season_id join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
  where ts.status='active' and c.status='active' and ss.name ~ '^20[0-9]{2}/[0-9]{2}$' and not exists(select 1 from public.team_seasons d where d.prepared_from_team_season_id=ts.id)
  and now()>=make_timestamptz(substring(ss.name from '^(20[0-9]{2})/')::int+1,5,1,0,0,0,'Europe/Vienna')
  and not exists(select 1 from season_lifecycle.plans p where p.source_id=ts.id and p.checked_at>now()-interval '1 day') order by ts.id limit 100
 loop
  begin perform season_lifecycle.prepare(s.id); count_prepared:=count_prepared+1;
  exception when others then
   insert into season_lifecycle.plans(source_id,checked_at,last_error) values(s.id,now(),sqlerrm) on conflict(source_id) do update set checked_at=now(),last_error=excluded.last_error;
  end;
 end loop;
 return count_prepared;
end $$;

revoke all on all functions in schema season_lifecycle from public,anon,authenticated,service_role;
revoke all on function public.get_season_lifecycle(uuid),public.prepare_season_lifecycle(uuid,text,text),public.snooze_season_lifecycle(uuid),public.finish_season_lifecycle(uuid,uuid,text,boolean,boolean,uuid[],text,boolean),public.resolve_event_team_season(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.get_season_lifecycle(uuid),public.prepare_season_lifecycle(uuid,text,text),public.snooze_season_lifecycle(uuid),public.finish_season_lifecycle(uuid,uuid,text,boolean,boolean,uuid[],text,boolean),public.resolve_event_team_season(uuid,timestamptz,text,text) to authenticated;
