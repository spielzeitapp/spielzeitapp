-- Qualify the context variable independently from team_seasons.season_id.
create or replace function h2h_private.opponent_context(p_match_id uuid, p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_season_id uuid; own_team uuid; opponent_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_event_id is not null then
    select e.team_season_id,e.opponent into v_season_id,opponent_name
    from public.events e where e.id=p_event_id and e.kind='match';
  else
    select m.team_season_id,m.opponent into v_season_id,opponent_name
    from public.matches m where m.id=p_match_id;
  end if;
  if v_season_id is null or not public.membership_is_staff_for_team_season(v_season_id) then
    raise exception 'Trainer access required' using errcode='42501';
  end if;
  select ts.team_id into own_team from public.team_seasons ts where ts.id=v_season_id;
  if own_team is null or nullif(trim(opponent_name),'') is null then raise exception 'Opponent context missing'; end if;
  return jsonb_build_object('team_id',own_team,'opponent',opponent_name);
end;
$$;
revoke all on function h2h_private.opponent_context(uuid,uuid) from public,anon,authenticated;
