create or replace function public.apply_tournament_plan(p_event uuid,p_url text,p_analysis jsonb,p_own_team text default null) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 select team_season_id into sid from public.events where id=p_event and kind='tournament';
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(sid),false) then raise exception 'Trainerzugriff erforderlich' using errcode='42501'; end if;
 -- Match the lock order used by automatic sync and by full plan replacement.
 perform pg_advisory_xact_lock(hashtextextended('tournament:'||p_event::text,0));
 if p_own_team is not null then
  if not exists(select 1 from jsonb_array_elements(p_analysis->'teams') t where t->>'teamName'=p_own_team) then raise exception 'Mannschaft nicht im Plan'; end if;
  if exists(select 1 from public.tournament_sync_state where event_id=p_event and own_team_name is not null and own_team_name<>p_own_team) and exists(select 1 from public.tournament_matches where tournament_event_id=p_event and match_id is not null) then raise exception 'Mannschaft bereits mit Spielen verknüpft'; end if;
  insert into public.tournament_sync_state(event_id,source_url,own_team_name) values(p_event,p_url,p_own_team) on conflict(event_id) do update set own_team_name=excluded.own_team_name;
 end if;
 perform tournament_sync.reconcile(p_event,p_url,p_analysis);
end $$;

create function public.replace_tournament_plan(
  p_event uuid,
  p_previous_url text,
  p_previous_slots uuid[],
  p_url text,
  p_analysis jsonb,
  p_own_team text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  state_row public.tournament_sync_state%rowtype;
  slot_ids uuid[];
  own_team text;
begin
  select * into event_row from public.events where id = p_event and kind = 'tournament';
  if not found or auth.uid() is null or not coalesce(
    public.is_platform_admin() or public.membership_is_staff_for_team_season(event_row.team_season_id), false
  ) then
    raise exception 'Trainerzugriff erforderlich.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tournament:' || p_event::text, 0));
  select * into event_row from public.events where id = p_event and kind = 'tournament' for update;
  if not found or event_row.tournament_completed_at is not null
    or coalesce(event_row.status, 'upcoming') in ('cancelled', 'canceled', 'deleted', 'finished') then
    raise exception 'Der Turniertermin ist nicht mehr bearbeitbar.';
  end if;
  if not coalesce(
    public.is_platform_admin() or public.membership_is_staff_for_team_season(event_row.team_season_id), false
  ) then
    raise exception 'Trainerzugriff erforderlich.' using errcode = '42501';
  end if;
  if event_row.official_tournament_url is distinct from p_previous_url then
    raise exception 'Der Turnierlink wurde inzwischen geändert. Bitte die Vorschau neu laden.';
  end if;

  select * into state_row from public.tournament_sync_state where event_id = p_event for update;
  if state_row.source_url = p_url and state_row.analysis->>'fetchedAt' is not null
    and (state_row.analysis->>'fetchedAt')::timestamptz > (p_analysis->>'fetchedAt')::timestamptz
    and (state_row.analysis->'rawMatches', state_row.analysis->'teams')
      is distinct from (p_analysis->'rawMatches', p_analysis->'teams') then
    raise exception 'Der Veranstalterplan wurde inzwischen aktualisiert. Bitte die Vorschau neu laden.';
  end if;

  if p_url is null or p_url !~ '^https?://([a-z0-9-]+[.])*(meinturnierplan[.](de|com)|tournament-live[.]com|tournamentbase[.]com|turnier[.]live|tournamentlive[.]com)(/|[?]|$)'
    or coalesce(p_analysis->>'provider', '') not in ('meinturnierplan', 'tournament-live')
    or jsonb_typeof(p_analysis->'rawMatches') is distinct from 'array'
    or jsonb_typeof(p_analysis->'teams') is distinct from 'array' then
    raise exception 'Der neue Turnierplan ist ungültig.';
  end if;
  if jsonb_array_length(p_analysis->'rawMatches') not between 1 and 500
    or jsonb_array_length(p_analysis->'teams') not between 1 and 100
    or exists (
      select 1 from jsonb_array_elements(p_analysis->'rawMatches') as match(value)
      group by value->>'externalMatchId'
      having nullif(btrim(value->>'externalMatchId'), '') is null or count(*) > 1
    )
    or exists (
      select 1 from jsonb_array_elements(p_analysis->'teams') as team(value)
      group by value->>'teamName'
      having nullif(btrim(value->>'teamName'), '') is null or count(*) > 1
    ) then
    raise exception 'Der neue Turnierplan ist unvollständig oder enthält doppelte Einträge.';
  end if;

  perform 1 from public.tournament_matches where tournament_event_id = p_event order by id for update;
  select coalesce(array_agg(id order by id), '{}') into slot_ids
    from public.tournament_matches where tournament_event_id = p_event;
  if p_previous_slots is null or slot_ids is distinct from array(select unnest(p_previous_slots) order by 1) then
    raise exception 'Der Spielplan wurde inzwischen geändert. Bitte die Vorschau neu laden.';
  end if;
  perform 1 from public.matches as match
    join public.tournament_matches as slot on slot.match_id = match.id
    where slot.tournament_event_id = p_event order by match.id for update of match;

  if exists (
    select 1 from public.tournament_matches as slot
    left join public.matches as match on match.id = slot.match_id
    where slot.tournament_event_id = p_event and (
      slot.official_status in ('live', 'finished')
      or slot.home_goals is not null or slot.away_goals is not null
      or match.status in ('live', 'finished')
      or match.live_started_at is not null
      or exists (select 1 from public.match_events where match_id = match.id)
    )
  ) then
    raise exception 'Der Turnierplan kann nur ersetzt werden, solange noch kein Spiel begonnen hat und keine Ergebnisse vorliegen.';
  end if;

  own_team := p_own_team;
  if own_team is null and exists (
    select 1 from jsonb_array_elements(p_analysis->'teams') as team(value)
    where value->>'teamName' = state_row.own_team_name
  ) then
    own_team := state_row.own_team_name;
  end if;

  -- Keep participant identities (and registrations) for teams still in the plan.
  delete from public.tournament_participants as participant
    where participant.tournament_event_id = p_event and not exists (
      select 1 from jsonb_array_elements(p_analysis->'teams') as team(value)
      where value->>'teamName' = participant.team_name
    );
  delete from public.matches as match using public.tournament_matches as slot
    where slot.tournament_event_id = p_event and slot.match_id = match.id;
  delete from public.tournament_matches where tournament_event_id = p_event;
  delete from public.tournament_sync_state where event_id = p_event;

  update public.events set official_tournament_url = p_url where id = p_event;
  perform public.apply_tournament_plan(p_event, p_url, p_analysis, own_team);

  if (select count(*) from public.tournament_matches where tournament_event_id = p_event)
    <> jsonb_array_length(p_analysis->'rawMatches') then
    raise exception 'Der neue Spielplan konnte nicht vollständig übernommen werden.';
  end if;
end;
$$;

revoke all on function public.replace_tournament_plan(uuid, text, uuid[], text, jsonb, text) from public, anon;
grant execute on function public.replace_tournament_plan(uuid, text, uuid[], text, jsonb, text) to authenticated;
