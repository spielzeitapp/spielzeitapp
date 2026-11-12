-- Internal hall training data: deliberately isolated from matches, feed and statistics.
create table public.hall_training_days (
 event_id uuid primary key references public.events(id) on delete cascade,
 state jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.hall_training_days enable row level security;
revoke all on public.hall_training_days from public,anon,authenticated;
grant select,insert,update on public.hall_training_days to authenticated;
create policy hall_training_staff_read on public.hall_training_days for select to authenticated
 using(exists(select 1 from public.events e where e.id=event_id and public.membership_is_staff_for_team_season(e.team_season_id)));
create policy hall_training_staff_insert on public.hall_training_days for insert to authenticated
 with check(exists(select 1 from public.events e join public.team_seasons ts on ts.id=e.team_season_id where e.id=event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft') and public.membership_is_staff_for_team_season(e.team_season_id)));
create policy hall_training_staff_update on public.hall_training_days for update to authenticated
 using(exists(select 1 from public.events e where e.id=event_id and public.membership_is_staff_for_team_season(e.team_season_id)))
 with check(exists(select 1 from public.events e join public.team_seasons ts on ts.id=e.team_season_id where e.id=event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft') and public.membership_is_staff_for_team_season(e.team_season_id)));

create function public.validate_hall_training_day() returns trigger language plpgsql security invoker set search_path='' as $$
declare sid uuid; s jsonb:=new.state; t jsonb; g jsonb; goal jsonb; pid text; assigned text[]:=array[]::text[];
 n integer; cy integer; dur integer; pause integer; sec integer; fmt integer; games integer; i integer; h integer; a integer; pair record;
begin
 select e.team_season_id into sid from public.events e join public.team_seasons ts on ts.id=e.team_season_id
 where e.id=new.event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft')
 and (coalesce(e.notes,'')||' '||coalesce(e.opponent,'')||' '||coalesce(e.location,'')) ~* '(hallen?[- ]?training|turnsaal|turnhalle|sporthalle)'
 for share of e;
 if not found or auth.uid() is null or not coalesce(public.membership_is_staff_for_team_season(sid),false) then raise exception 'Hallentraining ist nicht bearbeitbar' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.revision<>old.revision+1) then raise exception 'Hallenspieltag wurde geändert. Bitte neu laden'; end if;
 if tg_op='INSERT' and new.revision<>1 then raise exception 'Ungültige Revision'; end if;
 if jsonb_typeof(s) is distinct from 'object' or s->>'version' is distinct from '1' or jsonb_typeof(s->'teams') is distinct from 'array' or jsonb_typeof(s->'games') is distinct from 'array' or octet_length(s::text)>200000 then raise exception 'Ungültiger Hallenspieltag'; end if;
 n:=jsonb_array_length(s->'teams'); cy:=(s->>'cycles')::integer; dur:=(s->>'total')::integer; pause:=(s->>'pause')::integer; sec:=(s->>'seconds')::integer; fmt:=(s->>'format')::integer;
 if n not in (3,4) or coalesce(cy,0) not between 1 and 8 or coalesce(dur,0) not between 900 and 10800 or pause is null or pause not between 0 and 300 or coalesce(sec,0) not between 60 and 1800 or coalesce(fmt,0) not in (3,4) then raise exception 'Ungültige Dauer oder Spielform'; end if;
 games:=n*(n-1)/2*cy;
 if jsonb_array_length(s->'games')<>games or sec*games+pause*(games-1)>dur or coalesce((s->>'buffer')::integer,-1)<>dur-sec*games-pause*(games-1) then raise exception 'Spielzeit überschreitet Trainingsdauer'; end if;
 for t in select value from jsonb_array_elements(s->'teams') loop
  if coalesce(length(btrim(t->>'name')),0) not between 1 and 32 or jsonb_typeof(t->'playerIds') is distinct from 'array' or jsonb_array_length(t->'playerIds')>40 then raise exception 'Ungültige Mannschaft'; end if;
  for pid in select jsonb_array_elements_text(t->'playerIds') loop
   if pid=any(assigned) or not exists(select 1 from public.players p where p.id::text=pid and (p.team_season_id=sid or exists(select 1 from public.team_season_players sp where sp.team_season_id=sid and sp.player_id=p.id))) then raise exception 'Spieler doppelt oder nicht im Trainingskader'; end if;
   assigned:=array_append(assigned,pid);
  end loop;
 end loop;
 i:=0;
 for g in select value from jsonb_array_elements(s->'games') loop
  h:=(g->>'home')::integer; a:=(g->>'away')::integer;
  if h is null or a is null or h not between 0 and n-1 or a not between 0 and n-1 or h=a or coalesce(g->>'status','') not in ('pending','running','paused','finished') or coalesce((g->>'elapsed')::numeric,-1) not between 0 and sec or jsonb_typeof(g->'goals') is distinct from 'array' or jsonb_array_length(g->'goals')>200 then raise exception 'Ungültiges Trainingsspiel'; end if;
  if (g->>'status'='running' and (jsonb_typeof(g->'runningSince') is distinct from 'number' or (g->>'runningSince')::numeric<=0)) or (g->>'status'<>'running' and g->'runningSince' is distinct from 'null'::jsonb) then raise exception 'Ungültige Spieluhr'; end if;
  if g->>'status'<>'pending' and exists(select 1 from jsonb_array_elements(s->'teams') xteam(v) where jsonb_array_length(xteam.v->'playerIds')<fmt) then raise exception 'Alle Mannschaften brauchen genügend Spieler'; end if;
  if g->>'status'<>'pending' and exists(select 1 from jsonb_array_elements(s->'games') with ordinality z(v,k) where k<=i and v->>'status'<>'finished') then raise exception 'Vorheriges Spiel zuerst beenden'; end if;
  for goal in select value from jsonb_array_elements(g->'goals') loop
   if coalesce((goal->>'team')::integer,-1) not in(h,a) or coalesce((goal->>'second')::numeric,-1) not between 0 and sec then raise exception 'Ungültiges Tor'; end if;
  end loop;
  if g->>'status'='pending' and ((g->>'elapsed')::numeric<>0 or jsonb_array_length(g->'goals')<>0) then raise exception 'Nicht gestartetes Spiel enthält Ereignisse'; end if;
  i:=i+1;
 end loop;
 if (select count(*) from jsonb_array_elements(s->'games') xgame(v) where xgame.v->>'status' in ('running','paused'))>1 then raise exception 'Nur ein Spiel gleichzeitig'; end if;
 for h in 0..n-1 loop
  for a in h+1..n-1 loop
   if a>=n then continue; end if;
   if (select count(*) from jsonb_array_elements(s->'games') xgame(v) where least((xgame.v->>'home')::integer,(xgame.v->>'away')::integer)=h and greatest((xgame.v->>'home')::integer,(xgame.v->>'away')::integer)=a)<>cy then raise exception 'Jedes Team muss gleich oft gegen jedes andere spielen'; end if;
  end loop;
 end loop;
 new.updated_at:=clock_timestamp(); return new;
end $$;
revoke all on function public.validate_hall_training_day() from public,anon;
create trigger hall_training_validate before insert or update on public.hall_training_days for each row execute function public.validate_hall_training_day();

create function public.save_hall_training_day(p_event uuid,p_state jsonb,p_revision integer) returns integer language plpgsql security invoker set search_path='' as $$
declare current_revision integer; stamp integer;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hall-training:'||p_event::text,0));
 select revision into current_revision from public.hall_training_days where event_id=p_event for update;
 if coalesce(current_revision,0) is distinct from p_revision then raise exception 'Hallenspieltag wurde auf einem anderen Gerät geändert. Bitte neu laden'; end if;
 if current_revision is null then
  insert into public.hall_training_days(event_id,state,revision) values(p_event,p_state,1) returning revision into stamp;
 else
  update public.hall_training_days set state=p_state,revision=revision+1 where event_id=p_event and revision=p_revision returning revision into stamp;
  if stamp is null then raise exception 'Hallenspieltag wurde geändert. Bitte neu laden'; end if;
 end if;
 return stamp;
end $$;
revoke all on function public.save_hall_training_day(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_hall_training_day(uuid,jsonb,integer) to authenticated;
select pg_notify('pgrst','reload schema');
