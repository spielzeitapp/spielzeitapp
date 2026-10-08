-- Keep H2H confirmations separate from archived fixture results.
create table h2h_private.result_confirmations (
  match_id uuid primary key references public.matches(id) on delete cascade,
  score_home integer not null check (score_home >= 0),
  score_away integer not null check (score_away >= 0),
  team_score_home boolean,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now()
);
alter table h2h_private.result_confirmations enable row level security;
revoke all on h2h_private.result_confirmations from public, anon, authenticated;

-- Any changed result invalidates its previous confirmation, including a later revert.
create function h2h_private.invalidate_result_confirmation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from h2h_private.result_confirmations where match_id = new.id;
  return new;
end;
$$;
revoke all on function h2h_private.invalidate_result_confirmation() from public, anon, authenticated;
create trigger h2h_result_changed after update of score_home, score_away, status on public.matches
for each row when (old.score_home is distinct from new.score_home or old.score_away is distinct from new.score_away or old.status is distinct from new.status)
execute function h2h_private.invalidate_result_confirmation();

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
      else h2h_private.opponent_key(target.opponent) = h2h_private.opponent_key(c.opponent) end
  )
  select coalesce(jsonb_agg(to_jsonb(d) order by d.match_date desc, d.id), '[]'::jsonb) into result from duels d;
  return result;
end;
$$;
revoke all on function h2h_private.match_results(uuid) from public, anon;
grant execute on function h2h_private.match_results(uuid) to authenticated;


create function h2h_private.confirm_result(p_context_match_id uuid, p_history_match_id uuid,
  p_team_score_home boolean, p_expected_score_home integer, p_expected_score_away integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  context public.matches%rowtype;
  history public.matches%rowtype;
  context_team uuid;
  history_team uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into context from public.matches where id = p_context_match_id;
  if not found or not public.membership_is_staff_for_team_season(context.team_season_id) then
    raise exception 'Trainer access required' using errcode = '42501';
  end if;
  select * into history from public.matches where id = p_history_match_id for update;
  select team_id into context_team from public.team_seasons where id = context.team_season_id;
  select team_id into history_team from public.team_seasons where id = history.team_season_id;
  if history.id is null or history.status <> 'finished' or context_team is null or history_team is distinct from context_team
    or not exists (select 1 from jsonb_array_elements(h2h_private.match_results(context.id)) d where d->>'id' = history.id::text) then
    raise exception 'Match is not in this comparison' using errcode = '42501';
  end if;
  if history.score_home is distinct from p_expected_score_home or history.score_away is distinct from p_expected_score_away
    or history.score_home is null or history.score_away is null then
    raise exception 'Result changed; reload before confirming' using errcode = '40001';
  end if;
  insert into h2h_private.result_confirmations (match_id, score_home, score_away, team_score_home, confirmed_by)
  values (history.id, history.score_home, history.score_away, p_team_score_home, auth.uid())
  on conflict (match_id) do update set score_home = excluded.score_home, score_away = excluded.score_away,
    team_score_home = excluded.team_score_home, confirmed_by = excluded.confirmed_by, confirmed_at = now();
end;
$$;
revoke all on function h2h_private.confirm_result(uuid, uuid, boolean, integer, integer) from public, anon;
grant execute on function h2h_private.confirm_result(uuid, uuid, boolean, integer, integer) to authenticated;
create function public.confirm_head_to_head_result(p_context_match_id uuid, p_history_match_id uuid,
  p_team_score_home boolean, p_expected_score_home integer, p_expected_score_away integer)
returns void language sql security invoker set search_path = '' as $$
  select h2h_private.confirm_result(p_context_match_id, p_history_match_id, p_team_score_home, p_expected_score_home, p_expected_score_away);
$$;
revoke all on function public.confirm_head_to_head_result(uuid, uuid, boolean, integer, integer) from public, anon;
grant execute on function public.confirm_head_to_head_result(uuid, uuid, boolean, integer, integer) to authenticated;
