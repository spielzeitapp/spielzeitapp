alter table public.tournament_matches add column kickoff_actual_at timestamptz;

create function public.start_match_clock(p_match uuid)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  event_id uuid;
  season_id uuid;
  current_slot public.tournament_matches%rowtype;
  current_match public.matches%rowtype;
  provider_progress jsonb;
  planned_kickoff timestamptz;
  started_at timestamptz;
  kickoff_delay interval;
begin
  if auth.uid() is null or not coalesce(public.match_staff_can_write_for_match(p_match), false) then
    raise exception 'Spiel ist nicht bearbeitbar.' using errcode = '42501';
  end if;

  select s.tournament_event_id into event_id
    from public.tournament_matches s where s.match_id = p_match and s.is_own_team is distinct from false;

  -- The provider and manual schedule edits use the same lock before modifying this event.
  if event_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('tournament:' || event_id::text, 0));
    select e.team_season_id into season_id from public.events e
      where e.id = event_id and e.kind = 'tournament' and e.tournament_completed_at is null
        and coalesce(e.status, 'upcoming') not in ('finished','closed','completed','cancelled','canceled','deleted')
      for update;
    if found then
      select * into current_slot from public.tournament_matches s
        where s.tournament_event_id = event_id and s.match_id = p_match and s.is_own_team is distinct from false
        for update;
    end if;
  end if;

  select * into current_match from public.matches where id = p_match for update;
  if not found then raise exception 'Spiel wurde nicht gefunden.'; end if;
  if current_match.status = 'live' and current_match.live_is_running and current_match.live_started_at is not null then
    return current_match.live_started_at;
  end if;
  if coalesce(current_match.status, 'upcoming') not in ('upcoming','live') or current_match.live_started_at is not null
      or coalesce(current_match.live_elapsed_seconds, 0) <> 0 then
    raise exception 'Spiel wurde inzwischen aktualisiert. Bitte erneut öffnen.';
  end if;

  started_at := clock_timestamp();
  update public.matches set status = 'live', live_started_at = started_at,
    live_is_running = true, live_elapsed_seconds = 0 where id = p_match;
  if not found then raise exception 'Spiel ist nicht bearbeitbar.' using errcode = '42501'; end if;

  if current_slot.id is null or season_id is distinct from current_match.team_season_id then
    return started_at;
  end if;
  if current_slot.kickoff_actual_at is not null then return started_at; end if;

  planned_kickoff := case when current_slot.kickoff_delay_source_at = current_slot.kickoff_at
    then current_slot.kickoff_delay_until else current_slot.kickoff_at end;
  kickoff_delay := started_at - planned_kickoff;

  update public.tournament_matches set kickoff_actual_at = started_at where id = current_slot.id;
  if not found then raise exception 'Turnierspiel ist nicht bearbeitbar.' using errcode = '42501'; end if;
  if kickoff_delay <= interval '0 seconds' then return started_at; end if;

  -- A match started by an older app may not have taken the tournament lock.
  perform m.id from public.matches m
    join public.tournament_matches s on s.match_id = m.id
    where s.tournament_event_id = current_slot.tournament_event_id and s.id <> current_slot.id
      and m.team_season_id = current_match.team_season_id and m.status = 'upcoming'
      and nullif(lower(btrim(s.pitch)), '') is not distinct from nullif(lower(btrim(current_slot.pitch)), '')
    order by m.id for update of m;

  select analysis into provider_progress from public.tournament_sync_state
    where tournament_sync_state.event_id = current_slot.tournament_event_id;
  with pending as (
    select s.id, s.kickoff_at as source_kickoff, case when s.kickoff_delay_source_at = s.kickoff_at
      then s.kickoff_delay_until else s.kickoff_at end as effective_kickoff
    from public.tournament_matches s
    left join public.matches m on m.id = s.match_id
    where s.tournament_event_id = current_slot.tournament_event_id and s.id <> current_slot.id
      and nullif(lower(btrim(s.pitch)), '') is not distinct from nullif(lower(btrim(current_slot.pitch)), '')
      and s.kickoff_actual_at is null
      and coalesce(s.official_status, 'upcoming') in ('upcoming', 'scheduled', 'planned')
      and (s.home_goals is null or s.away_goals is null)
      and (s.match_id is null or (
        m.team_season_id = current_match.team_season_id and m.status = 'upcoming'
        and m.live_started_at is null and coalesce(m.live_elapsed_seconds, 0) = 0))
      and not exists (
        select from jsonb_array_elements(coalesce(provider_progress->'rawMatches', '[]'::jsonb)) fixture
        where (s.external_match_id = fixture->>'externalMatchId'
          or s.external_match_id = (provider_progress->>'provider') || ':' || (fixture->>'externalMatchId'))
          and (fixture->>'isLive' = 'true' or fixture->>'hasResult' = 'true')
      )
  )
  update public.tournament_matches s set
    kickoff_delay_source_at = pending.source_kickoff,
    kickoff_delay_until = pending.effective_kickoff + kickoff_delay
    from pending
    where s.id = pending.id and s.kickoff_at = pending.source_kickoff
      and pending.effective_kickoff >= planned_kickoff;

  return started_at;
end
$$;

revoke all on function public.start_match_clock(uuid) from public, anon;
grant execute on function public.start_match_clock(uuid) to authenticated;
