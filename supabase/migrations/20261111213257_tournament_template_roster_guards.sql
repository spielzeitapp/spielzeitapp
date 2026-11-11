create or replace function public.validate_tournament_lineup_template(p_event uuid,p_blocks jsonb,p_complete boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare sid uuid; v jsonb; entry record; allowed text[]; assigned text[]; squad text[]; formation text; block text; size integer; first_size integer;
begin
 select e.team_season_id into sid from public.events e join public.team_seasons ts on ts.id=e.team_season_id
 where e.id=p_event and e.kind='tournament' and e.tournament_completed_at is null and coalesce(e.status,'upcoming') not in ('finished','cancelled','canceled','deleted') and ts.status in ('active','draft') for share of e,ts;
 if not found or auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(sid),false) then raise exception 'Turnier ist nicht bearbeitbar' using errcode='42501'; end if;
 if p_blocks->>'version' is distinct from '1' or coalesce(p_blocks->>'startVariant','') not in ('1','2') or jsonb_typeof(p_blocks->'variants') is distinct from 'object' then raise exception 'Ungültige Blockplanung'; end if;
 foreach block in array array['1','2'] loop
  v:=p_blocks->'variants'->block; formation:=v->>'formationId';
  allowed:=case formation when '1-2-2' then array['GK','LB','RB','LW','RW'] when '1-2-1-2' then array['GK','LB','RB','CM','LW','RW'] when '1-2-2-2' then array['GK','LB','RB','CM','LW','RW','ST'] when '1-2-3-1' then array['GK','LB','RB','CM','LW','RW','ST'] when '1-3-2-1' then array['GK','LB','RB','CM','LW','RW','ST'] when '1-3-3' then array['GK','LB','RB','CM','LW','RW','ST'] else null end;
  if allowed is null or jsonb_typeof(v->'slots') is distinct from 'object' or jsonb_typeof(v->'squadIds') is distinct from 'array' or jsonb_array_length(v->'squadIds')>40 then raise exception 'Ungültige Formation oder Kader'; end if;
  size:=cardinality(allowed); if first_size is not null and first_size<>size then raise exception 'Beide Blöcke benötigen dieselbe Spielform'; end if; first_size:=size;
  select coalesce(array_agg(x),array[]::text[]) into squad from jsonb_array_elements_text(v->'squadIds') x;
  if cardinality(squad)<>(select count(distinct x) from unnest(squad) x) then raise exception 'Spieler doppelt im Kader'; end if;
  if exists(select 1 from unnest(squad) x where not exists(select 1 from public.tournament_squad s join public.players p on p.id=s.player_id where s.tournament_event_id=p_event and s.player_id::text=x and (p.team_season_id=sid or exists(select 1 from public.team_season_players sp where sp.player_id=p.id and sp.team_season_id=sid)))) then raise exception 'Spieler ist nicht im aktuellen Turnierkader'; end if;
  if p_complete and cardinality(squad)<>(select count(*) from public.tournament_squad where tournament_event_id=p_event) then raise exception 'Turnierkader wurde geändert. Grundaufstellung bitte neu speichern'; end if;
  assigned:=array[]::text[];
  for entry in select key,value from jsonb_each_text(v->'slots') loop
   if entry.key<>all(array['GK','LB','RB','CM','LW','RW','ST','FP']) then raise exception 'Ungültige Position'; end if;
   if entry.value is not null then
    if entry.key<>all(allowed) or entry.value<>all(squad) or entry.value=any(assigned) then raise exception 'Ungültiger oder doppelt aufgestellter Spieler'; end if;
    if p_complete and exists(select 1 from public.players where id::text=entry.value and is_injured) then raise exception 'Verletzte Spieler können nicht aufgestellt werden'; end if;
    assigned:=array_append(assigned,entry.value);
   end if;
  end loop;
  if p_complete and cardinality(assigned)<>size then raise exception 'Beide Blöcke müssen vollständig aufgestellt sein'; end if;
 end loop;
end $$;
select pg_notify('pgrst','reload schema');
