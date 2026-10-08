create or replace function h2h_private.fixture_results(p_team_season_id uuid, p_opponent text, p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  stable_team_id uuid;
  target_slug text;
  target_group uuid;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships where user_id = auth.uid() and team_season_id = p_team_season_id
  ) then raise exception 'No access to this team season' using errcode = '42501'; end if;
  select team_id into stable_team_id from public.team_seasons where id = p_team_season_id;
  target_slug := nullif(trim(p_slug), '');
  select a.group_id into target_group from h2h_private.opponent_aliases a
  where a.team_id=stable_team_id and a.name_key=h2h_private.opponent_key(p_opponent);

  with candidates as (
    select m.*, s.name as season_name, t.name as own_team_name,
      ts.age_group as own_age_group, ts.display_name as own_display_name, e.is_home, e.opponent_slug,
      tm.match_id is not null as is_tournament, v.team_score_home as confirmed_side,
      v.match_id is not null as result_confirmed
    from public.team_seasons ts
    join public.seasons s on s.id = ts.season_id
    join public.teams t on t.id = ts.team_id
    join public.matches m on m.team_season_id = ts.id
    left join lateral (
      select ev.is_home, ev.opponent_slug from public.events ev
      where ev.match_id = m.id and ev.team_season_id = ts.id
      order by ev.created_at desc limit 1
    ) e on true
    left join lateral (
      select t.match_id from public.tournament_matches t
      where t.match_id = m.id and t.is_own_team is true limit 1
    ) tm on true
    left join h2h_private.result_confirmations v on v.match_id = m.id
      and v.score_home = m.score_home and v.score_away = m.score_away
    where ts.team_id = stable_team_id and m.status = 'finished'
      and m.match_date is not null and m.match_date <= now()
      and not exists (
        select 1 from public.events ev where ev.match_id = m.id
        and (lower(coalesce(ev.status, '')) in ('canceled', 'cancelled', 'deleted')
          or lower(coalesce(ev.fixture_status, '')) in ('canceled', 'cancelled', 'deleted'))
      )
      and not exists (
        select 1 from public.tournament_matches t join public.events ev on ev.id = t.tournament_event_id
        where t.match_id = m.id and (t.is_own_team is false
          or lower(coalesce(ev.status, '')) in ('canceled', 'cancelled', 'deleted')
          or lower(coalesce(ev.fixture_status, '')) in ('canceled', 'cancelled', 'deleted'))
      )
  ), duels as (
    select c.id, c.team_season_id, c.season_name, c.own_team_name, c.own_age_group, c.own_display_name, c.opponent, c.match_date,
      case when c.is_tournament then null else c.is_home end as is_home, c.is_tournament,
      c.score_home as stored_score_home, c.score_away as stored_score_away,
      (c.is_tournament or c.is_home is not null or c.confirmed_side is not null) as side_known,
      (c.score_home <> 0 or c.score_away <> 0 or c.result_confirmed) as result_verified,
      case when c.score_home = 0 and c.score_away = 0 and not c.result_confirmed then null
        when c.is_tournament or coalesce(c.is_home, c.confirmed_side) is true then c.score_home
        when coalesce(c.is_home, c.confirmed_side) is false then c.score_away else null end as team_goals,
      case when c.score_home = 0 and c.score_away = 0 and not c.result_confirmed then null
        when c.is_tournament or coalesce(c.is_home, c.confirmed_side) is true then c.score_away
        when coalesce(c.is_home, c.confirmed_side) is false then c.score_home else null end as opponent_goals
    from candidates c
    where not exists (
      select 1 from h2h_private.opponent_decisions d where d.team_id=stable_team_id
      and not d.is_same and d.key_a=least(h2h_private.opponent_key(p_opponent),h2h_private.opponent_key(c.opponent))
      and d.key_b=greatest(h2h_private.opponent_key(p_opponent),h2h_private.opponent_key(c.opponent))
    ) and (
      (target_group is not null and exists (
        select 1 from h2h_private.opponent_aliases a where a.team_id=stable_team_id
        and a.name_key=h2h_private.opponent_key(c.opponent) and a.group_id=target_group
      )) or (
        h2h_private.opponent_key(p_opponent)=h2h_private.opponent_key(c.opponent)
        and (target_slug is null or nullif(trim(c.opponent_slug),'') is null or target_slug=trim(c.opponent_slug))
      )
    )
  )
  select coalesce(jsonb_agg(to_jsonb(d) order by d.match_date desc, d.id), '[]'::jsonb) into result from duels d;
  return result;
end;
$$;

revoke all on function h2h_private.fixture_results(uuid,text,text) from public, anon, authenticated;
