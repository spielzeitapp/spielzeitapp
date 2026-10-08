-- Limited historical-results API: no archived roster, attendance or notes exposed.
-- Only members of the requested match's season can read results for its stable team.
create schema if not exists h2h_private;
revoke all on schema h2h_private from public, anon;
grant usage on schema h2h_private to authenticated;

create or replace function h2h_private.opponent_key(value text)
returns text language sql immutable strict set search_path = '' as $$
  select string_agg(token, ' ' order by token collate "C")
  from regexp_split_to_table(
    regexp_replace(translate(replace(lower(value), 'ß', 'ss'), 'äöü', 'aou'), '[^a-z0-9]+', ' ', 'g'), '\s+'
  ) as token where token <> '';
$$;
revoke all on function h2h_private.opponent_key(text) from public, anon, authenticated;

create or replace function h2h_private.match_results(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target public.matches%rowtype;
  stable_team_id uuid;
  target_slug text;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into target from public.matches where id = p_match_id;
  if not found or not exists (
    select 1 from public.memberships where user_id = auth.uid() and team_season_id = target.team_season_id
  ) then
    raise exception 'No access to this match' using errcode = '42501';
  end if;
  select team_id into stable_team_id from public.team_seasons where id = target.team_season_id;
  select nullif(trim(e.opponent_slug), '') into target_slug from public.events e
  where e.match_id = target.id and e.team_season_id = target.team_season_id
  order by e.created_at desc limit 1;

  with candidates as (
    select m.*, s.name as season_name, e.is_home, e.opponent_slug,
      tm.match_id is not null as is_tournament
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
      case when c.is_tournament or c.is_home is true then c.score_home
        when c.is_home is false then c.score_away else null end as team_goals,
      case when c.is_tournament or c.is_home is true then c.score_away
        when c.is_home is false then c.score_home else null end as opponent_goals
    from candidates c
    where case when target_slug is not null and nullif(trim(c.opponent_slug), '') is not null
      then target_slug = trim(c.opponent_slug)
      else h2h_private.opponent_key(target.opponent) = h2h_private.opponent_key(c.opponent) end
  )
  select coalesce(jsonb_agg(to_jsonb(d) order by d.match_date desc, d.id), '[]'::jsonb) into result from duels d;
  return result;
end;
$$;
revoke all on function h2h_private.match_results(uuid) from public, anon;
grant execute on function h2h_private.match_results(uuid) to authenticated;

create or replace function public.get_match_head_to_head(p_match_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select h2h_private.match_results(p_match_id);
$$;
revoke all on function public.get_match_head_to_head(uuid) from public, anon;
grant execute on function public.get_match_head_to_head(uuid) to authenticated;
