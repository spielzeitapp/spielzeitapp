-- Only confirmed names are grouped, scoped to our stable team across seasons.
-- Historic matches, events and their original opponent names stay untouched.
create table h2h_private.opponent_aliases (
  team_id uuid not null references public.teams(id) on delete cascade,
  name_key text not null,
  group_id uuid not null,
  primary key (team_id, name_key)
);
create index opponent_alias_group_idx on h2h_private.opponent_aliases(team_id, group_id);
create table h2h_private.opponent_decisions (
  team_id uuid not null references public.teams(id) on delete cascade,
  key_a text not null, key_b text not null,
  name_a text not null, name_b text not null,
  is_same boolean not null,
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  primary key (team_id, key_a, key_b),
  check (key_a < key_b)
);
alter table h2h_private.opponent_aliases enable row level security;
alter table h2h_private.opponent_decisions enable row level security;
revoke all on h2h_private.opponent_aliases, h2h_private.opponent_decisions from public, anon, authenticated;
create policy opponent_aliases_no_direct_access on h2h_private.opponent_aliases
for all to authenticated using (false) with check (false);
create policy opponent_decisions_no_direct_access on h2h_private.opponent_decisions
for all to authenticated using (false) with check (false);

-- Removing a leading club prefix is ONLY a suggestion, never an automatic match.
-- A/B, age groups and all other remaining words remain part of the key.
create function h2h_private.opponent_proposal_key(value text)
returns text language sql immutable strict set search_path = '' as $$
  select h2h_private.opponent_key(regexp_replace(trim(value),
    '^(SPG|USG|NSG|USC|ASK|SV|SC|SK|FC|TSV)[ .-]+', '', 'i'));
$$;
revoke all on function h2h_private.opponent_proposal_key(text) from public, anon, authenticated;

create function h2h_private.opponent_context(p_match_id uuid, p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare season_id uuid; own_team uuid; opponent_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_event_id is not null then
    select e.team_season_id, e.opponent into season_id, opponent_name
    from public.events e where e.id=p_event_id and e.kind='match';
  else
    select m.team_season_id, m.opponent into season_id, opponent_name
    from public.matches m where m.id=p_match_id;
  end if;
  if season_id is null or not public.membership_is_staff_for_team_season(season_id) then
    raise exception 'Trainer access required' using errcode='42501';
  end if;
  select ts.team_id into own_team from public.team_seasons ts where ts.id=season_id;
  if own_team is null or nullif(trim(opponent_name),'') is null then
    raise exception 'Opponent context missing';
  end if;
  return jsonb_build_object('team_id',own_team,'opponent',opponent_name);
end;
$$;
revoke all on function h2h_private.opponent_context(uuid,uuid) from public, anon, authenticated;

create function h2h_private.opponent_candidates(p_match_id uuid, p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare context jsonb; own_team uuid; current_name text; current_key text; current_group uuid; result jsonb;
begin
  context:=h2h_private.opponent_context(p_match_id,p_event_id);
  own_team:=(context->>'team_id')::uuid;
  current_name:=context->>'opponent'; current_key:=h2h_private.opponent_key(current_name);
  select a.group_id into current_group from h2h_private.opponent_aliases a
  where a.team_id=own_team and a.name_key=current_key;
  with names as (
    select min(m.opponent) as candidate_name, h2h_private.opponent_key(m.opponent) as name_key, count(*) as match_count
    from public.matches m join public.team_seasons ts on ts.id=m.team_season_id
    where ts.team_id=own_team and m.status='finished' and m.match_date<=now()
      and h2h_private.opponent_proposal_key(m.opponent)=h2h_private.opponent_proposal_key(current_name)
    group by h2h_private.opponent_key(m.opponent)
  ), suggestions as (
    select current_name as current_name, n.candidate_name, n.match_count from names n
    left join h2h_private.opponent_aliases a on a.team_id=own_team and a.name_key=n.name_key
    where n.name_key<>current_key
      and (current_group is null or a.group_id is distinct from current_group)
      and not exists (select 1 from h2h_private.opponent_decisions d where d.team_id=own_team
        and d.key_a=least(current_key,n.name_key) and d.key_b=greatest(current_key,n.name_key))
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.candidate_name),'[]'::jsonb) into result from suggestions s;
  return result;
end;
$$;
revoke all on function h2h_private.opponent_candidates(uuid,uuid) from public, anon;
grant execute on function h2h_private.opponent_candidates(uuid,uuid) to authenticated;

create function h2h_private.decide_opponent(p_match_id uuid, p_event_id uuid,
  p_candidate_name text, p_expected_current_name text, p_is_same boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare context jsonb; own_team uuid; current_name text; current_key text; candidate_key text;
  current_group uuid; candidate_group uuid; chosen_group uuid; previous boolean;
begin
  context:=h2h_private.opponent_context(p_match_id,p_event_id);
  own_team:=(context->>'team_id')::uuid; current_name:=context->>'opponent';
  if current_name is distinct from p_expected_current_name or p_is_same is null then
    raise exception 'Opponent changed; reload before confirming' using errcode='40001';
  end if;
  current_key:=h2h_private.opponent_key(current_name);
  candidate_key:=h2h_private.opponent_key(p_candidate_name);
  if candidate_key is null or candidate_key=current_key
    or h2h_private.opponent_proposal_key(current_name) is distinct from h2h_private.opponent_proposal_key(p_candidate_name)
    or not exists (select 1 from public.matches m join public.team_seasons ts on ts.id=m.team_season_id
      where ts.team_id=own_team and m.status='finished' and m.match_date<=now() and m.opponent=p_candidate_name) then
    raise exception 'Not a valid opponent proposal' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('h2h-alias:'||own_team::text,0));
  select d.is_same into previous from h2h_private.opponent_decisions d where d.team_id=own_team
    and d.key_a=least(current_key,candidate_key) and d.key_b=greatest(current_key,candidate_key);
  if found then
    if previous=p_is_same then return; end if;
    raise exception 'This pair has already been decided';
  end if;
  select a.group_id into current_group from h2h_private.opponent_aliases a where a.team_id=own_team and a.name_key=current_key;
  select a.group_id into candidate_group from h2h_private.opponent_aliases a where a.team_id=own_team and a.name_key=candidate_key;
  if p_is_same then
    -- Do not silently undo an earlier 'different opponent' decision through a third alias.
    if exists (
      select 1 from h2h_private.opponent_decisions d where d.team_id=own_team and not d.is_same
      and d.key_a in (select a.name_key from h2h_private.opponent_aliases a where a.team_id=own_team
        and a.group_id in (current_group,candidate_group) union select current_key union select candidate_key)
      and d.key_b in (select a.name_key from h2h_private.opponent_aliases a where a.team_id=own_team
        and a.group_id in (current_group,candidate_group) union select current_key union select candidate_key)
    ) then raise exception 'Conflicts with an earlier opponent decision'; end if;
    chosen_group:=coalesce(current_group,candidate_group,gen_random_uuid());
    if current_group is not null and candidate_group is not null and current_group<>candidate_group then
      update h2h_private.opponent_aliases set group_id=chosen_group where team_id=own_team and group_id=candidate_group;
    end if;
    insert into h2h_private.opponent_aliases(team_id,name_key,group_id)
    values (own_team,current_key,chosen_group),(own_team,candidate_key,chosen_group)
    on conflict (team_id,name_key) do update set group_id=excluded.group_id;
  elsif current_group is not null and current_group=candidate_group then
    raise exception 'These names are already grouped';
  end if;
  insert into h2h_private.opponent_decisions(team_id,key_a,key_b,name_a,name_b,is_same,decided_by)
  values (own_team,least(current_key,candidate_key),greatest(current_key,candidate_key),
    case when current_key<candidate_key then current_name else p_candidate_name end,
    case when current_key<candidate_key then p_candidate_name else current_name end,p_is_same,auth.uid());
end;
$$;
revoke all on function h2h_private.decide_opponent(uuid,uuid,text,text,boolean) from public, anon;
grant execute on function h2h_private.decide_opponent(uuid,uuid,text,text,boolean) to authenticated;

create function public.get_head_to_head_opponent_candidates(p_match_id uuid, p_event_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select h2h_private.opponent_candidates(p_match_id,p_event_id);
$$;
revoke all on function public.get_head_to_head_opponent_candidates(uuid,uuid) from public, anon;
grant execute on function public.get_head_to_head_opponent_candidates(uuid,uuid) to authenticated;
create function public.decide_head_to_head_opponent(p_match_id uuid, p_event_id uuid,
  p_candidate_name text, p_expected_current_name text, p_is_same boolean)
returns void language sql security invoker set search_path = '' as $$
  select h2h_private.decide_opponent(p_match_id,p_event_id,p_candidate_name,p_expected_current_name,p_is_same);
$$;
revoke all on function public.decide_head_to_head_opponent(uuid,uuid,text,text,boolean) from public, anon;
grant execute on function public.decide_head_to_head_opponent(uuid,uuid,text,text,boolean) to authenticated;

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

