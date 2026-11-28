alter table public.tournament_matches
  add column kickoff_delay_source_at timestamptz,
  add column kickoff_delay_until timestamptz,
  add constraint tournament_kickoff_delay_pair
    check ((kickoff_delay_source_at is null) = (kickoff_delay_until is null));

create function public.delay_tournament_schedule(
  p_event uuid, p_first uuid, p_expected timestamptz, p_minutes integer
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  tournament public.events%rowtype;
  first_kickoff timestamptz;
  provider_progress jsonb;
  affected integer;
  expected_count integer;
begin
  if p_minutes is null or p_minutes not between 1 and 180 or p_expected is null then
    raise exception 'Bitte eine Verzögerung zwischen 1 und 180 Minuten wählen.';
  end if;

  -- Use the same lock as the provider sync so the preview can be checked against one schedule.
  perform pg_advisory_xact_lock(hashtextextended('tournament:' || p_event::text, 0));
  select e.* into tournament from public.events e
    join public.team_seasons ts on ts.id = e.team_season_id
    where e.id = p_event and e.kind = 'tournament' and e.tournament_completed_at is null
      and ts.status in ('active', 'draft')
      and coalesce(e.status, 'upcoming') not in ('finished','closed','completed','cancelled','canceled','deleted')
    for update of e;
  if not found or auth.uid() is null or not coalesce(
    public.is_platform_admin() or public.membership_is_staff_for_team_season(tournament.team_season_id), false
  ) then raise exception 'Turnier ist nicht bearbeitbar.' using errcode = '42501'; end if;

  select analysis into provider_progress from public.tournament_sync_state where event_id = p_event;

  -- Lock linked matches before checking their state, in case a trainer just started one.
  perform m.id from public.matches m
    join public.tournament_matches s on s.match_id = m.id
    where s.tournament_event_id = p_event and m.team_season_id = tournament.team_season_id
    order by m.id for update of m;

  with pending as materialized (
    select s.id, s.kickoff_at as source_kickoff, s.kickoff_delay_until as previous_delay, case when s.kickoff_delay_source_at = s.kickoff_at
      then s.kickoff_delay_until else s.kickoff_at end as current_kickoff
    from public.tournament_matches s
    left join public.matches m on m.id = s.match_id
    where s.tournament_event_id = p_event
      and coalesce(s.official_status, 'upcoming') in ('upcoming', 'scheduled', 'planned')
      and (s.home_goals is null or s.away_goals is null)
      and (s.match_id is null or (
        m.team_season_id = tournament.team_season_id and m.status = 'upcoming'
        and m.live_started_at is null and coalesce(m.live_elapsed_seconds, 0) = 0))
      and not exists (
        select from jsonb_array_elements(coalesce(provider_progress->'rawMatches', '[]'::jsonb)) fixture
        where (s.external_match_id = fixture->>'externalMatchId'
          or s.external_match_id = (provider_progress->>'provider') || ':' || (fixture->>'externalMatchId'))
          and (fixture->>'isLive' = 'true' or fixture->>'hasResult' = 'true')
      )
  ), first_match as (
    select current_kickoff from pending where id = p_first and current_kickoff = p_expected
  ), targets as (
    select pending.* from pending, first_match
    where pending.current_kickoff >= first_match.current_kickoff
  ), shifted as (
    update public.tournament_matches s set
      kickoff_delay_source_at = s.kickoff_at,
      kickoff_delay_until = targets.current_kickoff + make_interval(mins => p_minutes)
      from targets
      where s.id = targets.id and s.kickoff_at = targets.source_kickoff
        and s.kickoff_delay_until is not distinct from targets.previous_delay
      returning s.id
  )
  select (select current_kickoff from first_match), (select count(*)::integer from shifted),
    (select count(*)::integer from targets)
    into first_kickoff, affected, expected_count;

  if first_kickoff is null or affected = 0 or affected <> expected_count then
    raise exception 'Der Spielplan hat sich geändert. Bitte neu laden und erneut auswählen.';
  end if;
  return affected;
end
$$;

revoke all on function public.delay_tournament_schedule(uuid, uuid, timestamptz, integer) from public, anon;
grant execute on function public.delay_tournament_schedule(uuid, uuid, timestamptz, integer) to authenticated;

create function public.clear_tournament_delay_on_source_change() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.kickoff_delay_source_at := null;
  new.kickoff_delay_until := null;
  return new;
end
$$;

revoke all on function public.clear_tournament_delay_on_source_change() from public, anon, authenticated;

create trigger tournament_delay_on_source_change
before update of kickoff_at on public.tournament_matches
for each row
when (old.kickoff_at is distinct from new.kickoff_at)
execute function public.clear_tournament_delay_on_source_change();
