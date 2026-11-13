-- Extend existing isolated training planner to all training events; preserve staff authorization.
create or replace function public.validate_hall_training_day() returns trigger language plpgsql security invoker set search_path='' as $$
declare sid uuid; s jsonb:=new.state; t jsonb; g jsonb; goal jsonb; pid text; assigned text[]:=array[]::text[];
 n integer; cy integer; dur integer; pause integer; sec integer; fmt integer; games integer; i integer; h integer; a integer; pair record; game_sec integer; planned integer; old_game jsonb;
begin
 select e.team_season_id into sid from public.events e join public.team_seasons ts on ts.id=e.team_season_id
 where e.id=new.event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft')
 for share of e;
 if not found or auth.uid() is null or not coalesce(public.membership_is_staff_for_team_season(sid),false) then raise exception 'Trainingsmatch ist nicht bearbeitbar' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.revision<>old.revision+1) then raise exception 'Hallenspieltag wurde geändert. Bitte neu laden'; end if;
 if tg_op='INSERT' and new.revision<>1 then raise exception 'Ungültige Revision'; end if;
 if jsonb_typeof(s) is distinct from 'object' or s->>'version' is distinct from '1' or jsonb_typeof(s->'teams') is distinct from 'array' or jsonb_typeof(s->'games') is distinct from 'array' or octet_length(s::text)>200000 then raise exception 'Ungültiger Hallenspieltag'; end if;
 n:=jsonb_array_length(s->'teams'); cy:=(s->>'cycles')::integer; dur:=(s->>'total')::integer; pause:=(s->>'pause')::integer; sec:=(s->>'seconds')::integer; fmt:=(s->>'format')::integer;
 if n not in (2,3,4) or coalesce(cy,0) not between 1 and 8 or coalesce(dur,0) not between 900 and 10800 or pause is null or pause not between 0 and 300 or coalesce(sec,0) not between 60 and 1800 or coalesce(fmt,0) not between 2 and 11 then raise exception 'Ungültige Dauer oder Spielform'; end if;
 games:=n*(n-1)/2*cy;
 select coalesce(sum(coalesce((v->>'seconds')::integer,sec)),0)+pause*(games-1) into planned from jsonb_array_elements(s->'games') x(v);
 if jsonb_array_length(s->'games')<>games or planned>10800 or coalesce((s->>'buffer')::integer,-1)<>greatest(0,dur-planned) then raise exception 'Ungültige Gesamtspielzeit'; end if;
 if planned>dur and not exists(select 1 from jsonb_array_elements(s->'games') x(v) where v ? 'seconds') then raise exception 'Spielzeit überschreitet Trainingsdauer'; end if;
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
  game_sec:=coalesce((g->>'seconds')::integer,sec);
  if (g ? 'seconds' and (jsonb_typeof(g->'seconds') is distinct from 'number' or (g->>'seconds')::numeric<>game_sec)) or game_sec not between 60 and 1800 then raise exception 'Spielzeit muss zwischen 1 und 30 Minuten liegen'; end if;
  if tg_op='UPDATE' then
   old_game:=old.state->'games'->i;
   if old_game->>'status'<>'pending' and g->>'status'<>'pending' and coalesce((old_game->>'seconds')::integer,(old.state->>'seconds')::integer)<>game_sec then raise exception 'Spielzeit nur vor Spielbeginn ändern'; end if;
  end if;
  if h is null or a is null or h not between 0 and n-1 or a not between 0 and n-1 or h=a or coalesce(g->>'status','') not in ('pending','running','paused','finished') or coalesce((g->>'elapsed')::numeric,-1) not between 0 and game_sec or jsonb_typeof(g->'goals') is distinct from 'array' or jsonb_array_length(g->'goals')>200 then raise exception 'Ungültiges Trainingsspiel'; end if;
  if (g->>'status'='running' and (jsonb_typeof(g->'runningSince') is distinct from 'number' or (g->>'runningSince')::numeric<=0)) or (g->>'status'<>'running' and g->'runningSince' is distinct from 'null'::jsonb) then raise exception 'Ungültige Spieluhr'; end if;
  if g->>'status'<>'pending' and exists(select 1 from jsonb_array_elements(s->'teams') xteam(v) where jsonb_array_length(xteam.v->'playerIds')<fmt) then raise exception 'Alle Mannschaften brauchen genügend Spieler'; end if;
  if g->>'status'<>'pending' and exists(select 1 from jsonb_array_elements(s->'games') with ordinality z(v,k) where k<=i and v->>'status'<>'finished') then raise exception 'Vorheriges Spiel zuerst beenden'; end if;
  for goal in select value from jsonb_array_elements(g->'goals') loop
   if coalesce((goal->>'team')::integer,-1) not in(h,a) or coalesce((goal->>'second')::numeric,-1) not between 0 and game_sec then raise exception 'Ungültiges Tor'; end if;
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
select pg_notify('pgrst','reload schema');
