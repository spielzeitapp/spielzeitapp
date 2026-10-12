-- Separate source attributions: never modify match scores, live events, minutes or trainer fields.
create table public.oefb_player_links (
 team_season_id uuid not null references public.team_seasons(id) on delete cascade,
 external_player_id text not null check (external_player_id ~ '^\d{1,10}$'),
 player_id uuid not null references public.players(id) on delete cascade,
 source_name text not null,
 confirmed_by uuid not null,
 updated_at timestamptz not null default now(),
 primary key(team_season_id,external_player_id), unique(team_season_id,player_id)
);
create table public.oefb_goal_attributions (
 id uuid primary key default gen_random_uuid(),
 team_season_id uuid not null references public.team_seasons(id) on delete cascade,
 match_id uuid not null references public.matches(id) on delete cascade,
 external_game_id text not null check(external_game_id ~ '^\d{1,10}$'),
 source_key text not null,
 external_player_id text not null,
 player_id uuid not null references public.players(id) on delete cascade,
 source_minute integer,
 score_home integer not null,
 score_away integer not null,
 confirmed_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(match_id,source_key)
);
create index on public.oefb_goal_attributions(team_season_id,player_id);
alter table public.oefb_player_links enable row level security;
alter table public.oefb_goal_attributions enable row level security;
revoke all on public.oefb_player_links, public.oefb_goal_attributions from public, anon, authenticated;
grant select on public.oefb_player_links, public.oefb_goal_attributions to authenticated;
create policy oefb_links_staff_read on public.oefb_player_links for select to authenticated
 using(public.is_platform_admin() or public.membership_is_staff_for_team_season(team_season_id));
create policy oefb_goals_season_read on public.oefb_goal_attributions for select to authenticated
 using(public.can_read_team_season(team_season_id));

-- Narrow support operation: only the requested season, no broad events/players SELECT grant.
create function public.oefb_assignment_context(p_team_season_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then
  raise exception 'Trainer access required' using errcode='42501';
 end if;
 return jsonb_build_object(
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name)) from public.players p
  where p.team_season_id=p_team_season_id or exists(select 1 from public.team_season_players tsp where tsp.team_season_id=p_team_season_id and tsp.player_id=p.id)),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(to_jsonb(l)) from public.oefb_player_links l where l.team_season_id=p_team_season_id),'[]'::jsonb),
 'games',coalesce((select jsonb_agg(jsonb_build_object('external_id',e.external_id,'is_home',e.is_home,'match_id',e.match_id)) from public.events e
  where e.team_season_id=p_team_season_id and e.external_source='oefb' and e.kind='match' and e.match_type='league' and e.starts_at<=now() and e.match_id is not null and e.status='finished' and e.is_home is not null),'[]'::jsonb));
end $$;

create function public.save_oefb_player_assignments(p_team_season_id uuid,p_players jsonb,p_reports jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; rep jsonb; g jsonb; pid uuid; ev public.events%rowtype; m public.matches%rowtype;
 ext text; fn text; ln text; sh integer; sa integer; ph integer; pa integer; gh integer; ga integer;
 created_count integer:=0; assigned integer:=0; protected_count integer:=0; unresolved integer:=0; mapped_count integer:=0;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then
  raise exception 'Trainer access required' using errcode='42501';
 end if;
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
  where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' for share of ts;
 if not found then raise exception 'Season is read-only' using errcode='42501'; end if;
 if jsonb_typeof(p_players) is distinct from 'array' or jsonb_array_length(p_players)>100 or jsonb_typeof(p_reports) is distinct from 'array' or jsonb_array_length(p_reports)>100 then raise exception 'Invalid preview'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_team_season_id::text, 410));
 for item in select value from jsonb_array_elements(p_players) loop
  ext:=item->>'external_player_id';
  if coalesce(ext,'') !~ '^\d{1,10}$' or length(coalesce(item->>'source_name','')) not between 1 and 250 then raise exception 'Invalid player identity'; end if;
  pid:=nullif(item->>'player_id','')::uuid;
  if pid is null then
   select l.player_id into pid from public.oefb_player_links l where l.team_season_id=p_team_season_id and l.external_player_id=ext;
   if pid is null then
    fn:=btrim(item->>'first_name'); ln:=btrim(item->>'last_name');
    if length(coalesce(fn,'')) not between 1 and 100 or length(coalesce(ln,'')) not between 1 and 100 then raise exception 'First and last name required'; end if;
    if exists(select 1 from public.players p where (p.team_season_id=p_team_season_id or exists(select 1 from public.team_season_players tsp where tsp.team_season_id=p_team_season_id and tsp.player_id=p.id)) and lower(btrim(p.first_name))=lower(fn) and lower(btrim(p.last_name))=lower(ln)) then raise exception 'Player already exists; confirm existing profile'; end if;
    insert into public.players(team_season_id,first_name,last_name,is_active,status,is_laz_player) values(p_team_season_id,fn,ln,true,'active',false) returning id into pid;
    insert into public.team_season_players(team_season_id,player_id,is_active,status,is_laz_player) values(p_team_season_id,pid,true,'active',false);
    created_count:=created_count+1;
   end if;
  end if;
  if not exists(select 1 from public.players p where p.id=pid and (p.team_season_id=p_team_season_id or exists(select 1 from public.team_season_players tsp where tsp.player_id=pid and tsp.team_season_id=p_team_season_id))) then raise exception 'Player belongs to a different roster' using errcode='42501'; end if;
  insert into public.oefb_player_links(team_season_id,external_player_id,player_id,source_name,confirmed_by)
   values(p_team_season_id,ext,pid,item->>'source_name',auth.uid())
   on conflict(team_season_id,external_player_id) do update set player_id=excluded.player_id,source_name=excluded.source_name,confirmed_by=excluded.confirmed_by,updated_at=now();
  mapped_count:=mapped_count+1;
 end loop;
 for rep in select value from jsonb_array_elements(p_reports) loop
  if coalesce(rep->>'external_id','') !~ '^\d{1,10}$' or coalesce(rep->>'score_home','') !~ '^\d{1,3}$' or coalesce(rep->>'score_away','') !~ '^\d{1,3}$' or jsonb_typeof(rep->'goals') is distinct from 'array' then raise exception 'Invalid report'; end if;
  if jsonb_array_length(rep->'goals')>200 then raise exception 'Too many goal events'; end if;
  select * into ev from public.events where team_season_id=p_team_season_id and external_source='oefb' and external_id=rep->>'external_id' and kind='match' and match_type='league' and starts_at<=now() and is_home is not null and status='finished' and match_id is not null for update;
  if not found then protected_count:=protected_count+1; continue; end if;
  select * into m from public.matches where id=ev.match_id and team_season_id=p_team_season_id and status='finished' for update;
  sh:=(rep->>'score_home')::integer; sa:=(rep->>'score_away')::integer;
  if not found or m.score_home is distinct from sh or m.score_away is distinct from sa or exists(select 1 from public.match_events me where me.match_id=ev.match_id and me.type in ('goal','goal_home','goal_away')) then protected_count:=protected_count+1; continue; end if;
  -- Complete, monotonic goal sequence must end at the already-confirmed score.
  ph:=0; pa:=0;
  for g in select value from jsonb_array_elements(rep->'goals') loop
   if coalesce(g->>'home','') !~ '^\d{1,3}$' or coalesce(g->>'away','') !~ '^\d{1,3}$' then raise exception 'Invalid goal sequence'; end if;
   gh:=(g->>'home')::integer; ga:=(g->>'away')::integer;
   if not ((gh=ph+1 and ga=pa) or (gh=ph and ga=pa+1)) then raise exception 'Incomplete goal sequence'; end if;
   ph:=gh;pa:=ga;
  end loop;
  if ph<>sh or pa<>sa then protected_count:=protected_count+1;continue;end if;
  delete from public.oefb_goal_attributions where match_id=ev.match_id;
  ph:=0;pa:=0;
  for g in select value from jsonb_array_elements(rep->'goals') loop
   gh:=(g->>'home')::integer;ga:=(g->>'away')::integer;
   if ((ev.is_home and gh>ph) or (not ev.is_home and ga>pa)) and coalesce((g->>'own_goal')::boolean,false)=false then
    select l.player_id into pid from public.oefb_player_links l where l.team_season_id=p_team_season_id and l.external_player_id=g->>'external_player_id';
    if pid is null then unresolved:=unresolved+1; else
     insert into public.oefb_goal_attributions(team_season_id,match_id,external_game_id,source_key,external_player_id,player_id,source_minute,score_home,score_away,confirmed_by)
      values(p_team_season_id,ev.match_id,ev.external_id,gh::text||':'||ga::text,g->>'external_player_id',pid,
       case when coalesce(g->>'minute','') ~ '^\d{1,3}$' then (g->>'minute')::integer else null end,sh,sa,auth.uid());
     assigned:=assigned+1;
    end if;
   end if;
   ph:=gh;pa:=ga;
  end loop;
 end loop;
 return jsonb_build_object('created',created_count,'mapped',mapped_count,'assigned_goals',assigned,'unresolved_goals',unresolved,'protected_matches',protected_count);
end $$;
revoke all on function public.oefb_assignment_context(uuid),public.save_oefb_player_assignments(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.oefb_assignment_context(uuid),public.save_oefb_player_assignments(uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
