set local lock_timeout = '5s';

alter table public.events add column tournament_match_rules jsonb
  check (tournament_match_rules is null or (
    kind = 'tournament' and jsonb_typeof(tournament_match_rules) = 'object'
    and coalesce((tournament_match_rules->>'duration')::integer between 1 and 120, false)
    and coalesce((tournament_match_rules->>'penalty')::integer between 1 and 15, false)
    and ((tournament_match_rules->>'minimum') is null or
      (tournament_match_rules->>'minimum')::integer between 1 and (tournament_match_rules->>'duration')::integer)
  ));
alter table public.matches add column tournament_playtime_override boolean not null default false;

create function public.save_tournament_match_rules(
  p_event uuid, p_duration integer, p_minimum integer, p_penalty integer, p_expected jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_event public.events%rowtype;
  rules jsonb;
begin
  if p_duration is null or p_duration not between 1 and 120
    or (p_minimum is not null and p_minimum not between 1 and p_duration)
    or p_penalty is null or p_penalty not between 1 and 15 then
    raise exception 'Ungültige Spieldauer, Mindestspielzeit oder Zeitstrafe';
  end if;

  select e.* into current_event from public.events e
  join public.team_seasons ts on ts.id = e.team_season_id
  where e.id = p_event and e.kind = 'tournament' and e.tournament_completed_at is null
    and coalesce(e.status, 'upcoming') not in ('finished','cancelled','canceled','deleted')
    and ts.status in ('active','draft')
  for update of e;
  if not found or auth.uid() is null or not coalesce(
    public.is_platform_admin() or public.membership_is_staff_for_team_season(current_event.team_season_id), false
  ) then raise exception 'Turnier ist nicht bearbeitbar' using errcode = '42501'; end if;
  if current_event.tournament_match_rules is distinct from p_expected then
    raise exception 'Turniervorgaben wurden geändert. Bitte neu laden';
  end if;

  rules := jsonb_build_object('duration', p_duration, 'minimum', p_minimum, 'penalty', p_penalty);
  update public.events set tournament_match_rules = rules where id = p_event;
  if not found then raise exception 'Turnier ist nicht bearbeitbar' using errcode = '42501'; end if;
  if current_event.tournament_match_rules is null then
    update public.matches m set tournament_playtime_override = true
    where m.team_season_id = current_event.team_season_id and m.status = 'upcoming'
      and m.live_started_at is null and not m.tournament_playtime_override
      and exists (select 1 from public.tournament_matches tm where tm.tournament_event_id = p_event
        and tm.match_id = m.id and tm.is_own_team and (m.minimum_playtime_enabled or
          (m.planned_match_minutes is not null and m.planned_match_minutes <> tm.planned_minutes)));
  end if;
  update public.matches m
    set planned_match_minutes = p_duration, minimum_playtime_enabled = p_minimum is not null,
        minimum_playtime_minutes = coalesce(p_minimum, least(20, p_duration))
  where m.team_season_id = current_event.team_season_id and m.status = 'upcoming'
    and m.live_started_at is null and not m.tournament_playtime_override
    and exists (select 1 from public.tournament_matches tm where tm.tournament_event_id = p_event
      and tm.match_id = m.id and tm.is_own_team);
  return rules;
end
$$;
revoke all on function public.save_tournament_match_rules(uuid, integer, integer, integer, jsonb) from public, anon;
grant execute on function public.save_tournament_match_rules(uuid, integer, integer, integer, jsonb) to authenticated;

create function public.inherit_tournament_match_rules() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  rules jsonb;
  season uuid;
  duration integer;
  minimum integer;
begin
  if new.match_id is null or not coalesce(new.is_own_team,false) then return new; end if;
  if tg_op = 'UPDATE' and new.match_id is not distinct from old.match_id
    and new.tournament_event_id = old.tournament_event_id and old.is_own_team then return new; end if;

  select tournament_match_rules, team_season_id into rules, season
  from public.events where id = new.tournament_event_id and kind = 'tournament' for share;
  if rules is null then return new; end if;
  duration := (rules->>'duration')::integer;
  minimum := (rules->>'minimum')::integer;
  update public.matches
    set planned_match_minutes = duration, minimum_playtime_enabled = minimum is not null,
        minimum_playtime_minutes = coalesce(minimum, least(20, duration))
  where id = new.match_id and team_season_id = season and status = 'upcoming'
    and live_started_at is null and not tournament_playtime_override;
  if found then new.planned_minutes := duration; end if;
  return new;
end
$$;
revoke all on function public.inherit_tournament_match_rules() from public, anon;
create trigger inherit_tournament_match_rules
before insert or update of match_id, tournament_event_id, is_own_team on public.tournament_matches
for each row execute function public.inherit_tournament_match_rules();

select pg_notify('pgrst', 'reload schema');
