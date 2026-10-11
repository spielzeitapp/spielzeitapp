-- Explicit, atomic result import into the existing match model. Never overwrite linked matches.
create or replace function public.import_oefb_results(p_team_season_id uuid, p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb; ev public.events%rowtype; mid uuid; n integer := 0; protected integer := 0;
  sh integer; sa integer;
begin
  if auth.uid() is null or not coalesce((public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id)),false) then
    raise exception 'Trainer access required' using errcode='42501';
  end if;
  perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' for share of ts;
  if not found then raise exception 'Season is read-only' using errcode='42501'; end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)>500 then raise exception 'Invalid results'; end if;
  for item in select value from jsonb_array_elements(p_results) loop
    if coalesce(item->>'score_home','') !~ '^\d{1,3}$' or coalesce(item->>'score_away','') !~ '^\d{1,3}$' then raise exception 'Invalid score'; end if;
    sh := (item->>'score_home')::integer; sa := (item->>'score_away')::integer;
    select * into ev from public.events where team_season_id=p_team_season_id and external_source='oefb'
      and external_id=item->>'external_id' and kind='match' and match_type='league'
      order by created_at limit 1 for update;
    if not found or ev.starts_at > now() or ev.is_home is null or (lower(coalesce(ev.status,'')) in ('cancelled','canceled','deleted') or lower(coalesce(ev.fixture_status,'')) in ('cancelled','canceled','deleted')) then
      protected := protected+1; continue;
    end if;
    if ev.match_id is not null then protected := protected+1; continue; end if;
    insert into public.matches(team_season_id,opponent,match_date,location,status,score_home,score_away,motm_enabled,auto_matchday_feed_enabled)
      values(p_team_season_id,ev.opponent,ev.starts_at,ev.location,'finished',sh,sa,false,false) returning id into mid;
    update public.events set match_id=mid,status='finished',fixture_status='published' where id=ev.id;
    insert into h2h_private.result_confirmations(match_id,score_home,score_away,team_score_home,confirmed_by)
      values(mid,sh,sa,ev.is_home,auth.uid());
    n := n+1;
  end loop;
  return jsonb_build_object('imported',n,'protected',protected);
end;
$$;
revoke all on function public.import_oefb_results(uuid,jsonb) from public,anon;
grant execute on function public.import_oefb_results(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
