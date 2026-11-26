-- Carry per-event confirmed group times across consecutive imports of an older provider schedule.
create table tournament_sync.confirmed_group_times (
  event_id uuid not null references public.events(id) on delete cascade,
  source_url text not null,
  external_id text not null,
  source_fixture jsonb not null,
  kickoff_at timestamptz not null,
  planned_minutes integer not null check (planned_minutes between 1 and 120),
  primary key (event_id, source_url, external_id)
);
alter table tournament_sync.confirmed_group_times enable row level security;
revoke all on tournament_sync.confirmed_group_times from public, anon, authenticated, service_role;

create function tournament_sync.apply_confirmed_group_times() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  overrides jsonb;
  schedule jsonb;
  adjusted jsonb := '[]';
  fixture jsonb;
  correction jsonb;
  external_id text;
  corrected_at timestamptz;
  corrected_minutes integer;
begin
  select jsonb_object_agg(c.external_id, to_jsonb(c)) into overrides
    from tournament_sync.confirmed_group_times c
    where c.event_id = new.event_id and c.source_url = new.source_url;
  schedule := new.analysis->'rawMatches';
  if overrides is null or jsonb_typeof(schedule) is distinct from 'array' then return new; end if;

  for fixture in select value from jsonb_array_elements(schedule) loop
    external_id := fixture->>'externalMatchId';
    correction := overrides->external_id;
    -- If the published schedule actually changes, use the organizer's new fixture.
    if fixture->>'phase' = 'group' and correction is not null
      and not exists (
        select 1 from public.tournament_matches slot
        where slot.tournament_event_id = new.event_id
          and slot.external_match_id = (new.analysis->>'provider') || ':' || external_id
          and slot.source = 'manual_override'
      ) and
      (fixture->'homeTeam', fixture->'awayTeam', fixture->'kickoffDate', fixture->'kickoffTimeHHmm', fixture->'plannedMinutes')
      is not distinct from
      (correction->'source_fixture'->'homeTeam', correction->'source_fixture'->'awayTeam',
       correction->'source_fixture'->'kickoffDate', correction->'source_fixture'->'kickoffTimeHHmm', correction->'source_fixture'->'plannedMinutes') then
      corrected_at := (correction->>'kickoff_at')::timestamptz;
      corrected_minutes := (correction->>'planned_minutes')::integer;
      update public.tournament_matches
        set kickoff_at = corrected_at, planned_minutes = corrected_minutes
        where tournament_event_id = new.event_id
          and external_match_id = (new.analysis->>'provider') || ':' || external_id;
      update public.matches as match
        set match_date = corrected_at, planned_match_minutes = corrected_minutes
        from public.tournament_matches as slot
        where slot.tournament_event_id = new.event_id
          and slot.external_match_id = (new.analysis->>'provider') || ':' || external_id
          and slot.match_id = match.id and match.status = 'upcoming' and match.live_started_at is null;
      fixture := fixture || jsonb_build_object(
        'kickoffTimeHHmm', to_char(corrected_at at time zone 'Europe/Vienna', 'HH24:MI'),
        'plannedMinutes', corrected_minutes);
    elsif correction is not null then
      delete from tournament_sync.confirmed_group_times c
        where c.event_id = new.event_id and c.source_url = new.source_url and c.external_id = fixture->>'externalMatchId';
    end if;
    adjusted := adjusted || jsonb_build_array(fixture);
  end loop;

  new.analysis := jsonb_set(new.analysis, '{rawMatches}', adjusted);
  return new;
end;
$$;

revoke all on function tournament_sync.apply_confirmed_group_times() from public, anon, authenticated, service_role;

create trigger tournament_sync_confirmed_group_times
before update of analysis on public.tournament_sync_state
for each row execute function tournament_sync.apply_confirmed_group_times();
