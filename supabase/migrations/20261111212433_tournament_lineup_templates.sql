create table public.tournament_lineup_templates (
 tournament_event_id uuid primary key references public.events(id) on delete cascade,
 blocks jsonb not null,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.tournament_lineup_templates enable row level security;
revoke all on public.tournament_lineup_templates from anon,authenticated;
grant select,insert,update on public.tournament_lineup_templates to authenticated;
create policy tournament_template_staff on public.tournament_lineup_templates for all to authenticated
 using(exists(select 1 from public.events e where e.id=tournament_event_id and (public.is_platform_admin() or public.membership_is_staff_for_team_season(e.team_season_id))))
 with check(exists(select 1 from public.events e where e.id=tournament_event_id and (public.is_platform_admin() or public.membership_is_staff_for_team_season(e.team_season_id))));
alter table public.matches add column tournament_lineup_blocks jsonb;

create function public.validate_tournament_lineup_template(p_event uuid,p_blocks jsonb,p_complete boolean default false) returns void
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
  assigned:=array[]::text[];
  for entry in select key,value from jsonb_each_text(v->'slots') loop
   if entry.key<>all(array['GK','LB','RB','CM','LW','RW','ST','FP']) then raise exception 'Ungültige Position'; end if;
   if entry.value is not null then
    if entry.key<>all(allowed) or entry.value<>all(squad) or entry.value=any(assigned) then raise exception 'Ungültiger oder doppelt aufgestellter Spieler'; end if;
    assigned:=array_append(assigned,entry.value);
   end if;
  end loop;
  if p_complete and cardinality(assigned)<>size then raise exception 'Beide Blöcke müssen vollständig aufgestellt sein'; end if;
 end loop;
end $$;
revoke all on function public.validate_tournament_lineup_template(uuid,jsonb,boolean) from public,anon;
grant execute on function public.validate_tournament_lineup_template(uuid,jsonb,boolean) to authenticated;

create function public.check_tournament_lineup_template_row() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform public.validate_tournament_lineup_template(new.tournament_event_id,new.blocks,false);
 new.updated_at:=clock_timestamp(); return new;
end $$;
revoke all on function public.check_tournament_lineup_template_row() from public,anon;
create trigger tournament_template_validate before insert or update on public.tournament_lineup_templates for each row execute function public.check_tournament_lineup_template_row();

create function public.save_tournament_lineup_template(p_event uuid,p_blocks jsonb,p_expected_updated_at timestamptz default null) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('template:'||p_event::text,0));
 perform public.validate_tournament_lineup_template(p_event,p_blocks,false);
 if p_expected_updated_at is null then
  if exists(select 1 from public.tournament_lineup_templates where tournament_event_id=p_event) then raise exception 'Grundaufstellung wurde geändert. Bitte neu laden'; end if;
  insert into public.tournament_lineup_templates(tournament_event_id,blocks) values(p_event,p_blocks) returning updated_at into stamp;
 else
  update public.tournament_lineup_templates set blocks=p_blocks where tournament_event_id=p_event and updated_at=p_expected_updated_at returning updated_at into stamp;
  if stamp is null then raise exception 'Grundaufstellung wurde geändert. Bitte neu laden'; end if;
 end if;
 return stamp;
end $$;
revoke all on function public.save_tournament_lineup_template(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.save_tournament_lineup_template(uuid,jsonb,timestamptz) to authenticated;

create function public.apply_tournament_lineup_template(p_event uuid,p_match uuid,p_expected_updated_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.tournament_lineup_templates%rowtype; m public.matches%rowtype; draft jsonb;
begin
 select * into t from public.tournament_lineup_templates where tournament_event_id=p_event for share;
 if not found or t.updated_at is distinct from p_expected_updated_at then raise exception 'Grundaufstellung wurde geändert. Bitte neu laden'; end if;
 perform public.validate_tournament_lineup_template(p_event,t.blocks,true);
 select * into m from public.matches where id=p_match for update;
 if not found or not public.match_staff_can_write_for_match(p_match) or m.status<>'upcoming' or m.live_started_at is not null or not exists(select 1 from public.tournament_matches s join public.events e on e.id=s.tournament_event_id where s.tournament_event_id=p_event and s.match_id=p_match and s.is_own_team and e.team_season_id=m.team_season_id) then raise exception 'Nur ein eigenes, noch nicht gestartetes Turnierspiel kann vorbereitet werden'; end if;
 if exists(select 1 from public.match_lineup where match_id=p_match) or exists(select 1 from public.match_events where match_id=p_match) then raise exception 'Dieses Spiel hat bereits eine Aufstellung oder Spielereignisse. Bitte im Spiel bearbeiten'; end if;
 draft:=t.blocks->'variants'->(t.blocks->>'startVariant');
 if exists(select 1 from public.match_bench b where b.match_id=p_match and b.player_id::text not in(select jsonb_array_elements_text(draft->'squadIds'))) then raise exception 'Der Spielkader wurde bereits anders gewählt. Bitte im Spiel bearbeiten'; end if;
 delete from public.match_bench where match_id=p_match;
 insert into public.match_lineup(match_id,slot,player_id) select p_match,key,value::uuid from jsonb_each_text(draft->'slots') where value is not null;
 insert into public.match_bench(match_id,player_id) select p_match,x::uuid from jsonb_array_elements_text(draft->'squadIds') x where x not in(select value from jsonb_each_text(draft->'slots') where value is not null);
 update public.matches set u11_formation_id=draft->>'formationId',tournament_lineup_blocks=t.blocks where id=p_match;
end $$;
revoke all on function public.apply_tournament_lineup_template(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.apply_tournament_lineup_template(uuid,uuid,timestamptz) to authenticated;
select pg_notify('pgrst','reload schema');
