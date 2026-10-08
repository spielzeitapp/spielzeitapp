-- Read-only previews work before a trainer creates or links a live-match row.
create or replace function h2h_private.fixture_results(p_team_season_id uuid, p_opponent text, p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  stable_team_id uuid;
  target_slug text;
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

  with candidates as (
    select m.*, s.name as season_name, e.is_home, e.opponent_slug,
      tm.match_id is not null as is_tournament, v.team_score_home as confirmed_side,
      v.match_id is not null as result_confirmed
    from public.team_seasons ts
    join public.seasons s on s.id = ts.season_id
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
    select c.id, c.team_season_id, c.season_name, c.opponent, c.match_date,
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
    where case when target_slug is not null and nullif(trim(c.opponent_slug), '') is not null
      then target_slug = trim(c.opponent_slug)
      else h2h_private.opponent_key(p_opponent) = h2h_private.opponent_key(c.opponent) end
  )
  select coalesce(jsonb_agg(to_jsonb(d) order by d.match_date desc, d.id), '[]'::jsonb) into result from duels d;
  return result;
end;
$$;

revoke all on function h2h_private.fixture_results(uuid,text,text) from public, anon, authenticated;

create or replace function h2h_private.match_results(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target public.matches%rowtype; slug text;
begin
  select * into target from public.matches where id = p_match_id;
  if not found then raise exception 'No access to this match' using errcode = '42501'; end if;
  select nullif(trim(e.opponent_slug), '') into slug from public.events e
  where e.match_id = target.id and e.team_season_id = target.team_season_id
  order by e.created_at desc limit 1;
  return h2h_private.fixture_results(target.team_season_id, target.opponent, slug);
end;
$$;
revoke all on function h2h_private.match_results(uuid) from public, anon;
grant execute on function h2h_private.match_results(uuid) to authenticated;

create function h2h_private.event_results(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target public.events%rowtype;
begin
  select * into target from public.events where id = p_event_id;
  if not found or target.kind <> 'match' then
    raise exception 'No access to this fixture' using errcode = '42501';
  end if;
  return h2h_private.fixture_results(target.team_season_id, target.opponent, target.opponent_slug);
end;
$$;
revoke all on function h2h_private.event_results(uuid) from public, anon;
grant execute on function h2h_private.event_results(uuid) to authenticated;

create function public.get_event_head_to_head(p_event_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select h2h_private.event_results(p_event_id);
$$;
revoke all on function public.get_event_head_to_head(uuid) from public, anon;
grant execute on function public.get_event_head_to_head(uuid) to authenticated;
