-- Run only against TEST. All changes are rolled back, including on assertion failure.
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_ts public.team_seasons%rowtype;
  v_team public.teams%rowtype;
  v_year text;
  v_other_team uuid;
  v_other_ts uuid;
  v_other_season uuid;
  v_before jsonb;
  v_after jsonb;
  v_count bigint;
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE is_admin = true LIMIT 1;
  IF v_admin IS NULL THEN
    SELECT user_id INTO v_admin FROM public.user_roles WHERE lower(trim(role)) = 'admin' LIMIT 1;
  END IF;
  ASSERT v_admin IS NOT NULL, 'An existing platform admin is required';
  SELECT ts.* INTO v_ts FROM public.team_seasons ts JOIN public.teams t ON t.id = ts.team_id
    WHERE public.club_is_operable(t.club_id) AND ts.status = 'active' ORDER BY ts.id LIMIT 1;
  ASSERT v_ts.id IS NOT NULL, 'An existing active team-season is required';
  SELECT * INTO v_team FROM public.teams WHERE id = v_ts.team_id;
  SELECT name INTO v_year FROM public.seasons WHERE id = v_ts.season_id;
  ASSERT NOT has_function_privilege('anon', 'public.admin_update_team_details(uuid,uuid,text,text,text,text,text,text)', 'EXECUTE');
  ASSERT has_function_privilege('authenticated', 'public.admin_update_team_details(uuid,uuid,text,text,text,text,text,text)', 'EXECUTE');
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  BEGIN
    PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Denied','U16',v_year,v_team.name,v_ts.age_group,v_year);
    RAISE EXCEPTION 'Non-admin write was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  BEGIN
    PERFORM public.admin_update_team_details(gen_random_uuid(),v_ts.id,'Denied','U16',v_year,v_team.name,v_ts.age_group,v_year);
    RAISE EXCEPTION 'Wrong-club write was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Denied','U16',v_year,'stale-name',v_ts.age_group,v_year);
    RAISE EXCEPTION 'Stale write was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Denied','U16','2026/29',v_team.name,v_ts.age_group,v_year);
    RAISE EXCEPTION 'Invalid season was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- All rows outside the edited metadata must remain identical.
  SELECT jsonb_build_object(
    'other_teams',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.teams t WHERE id <> v_team.id),
    'other_seasons',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.team_seasons t WHERE id <> v_ts.id),
    'players',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.players t),
    'events',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.events t),
    'memberships',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id,team_season_id,role) FROM public.memberships t)
  ) INTO v_before;
  PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Metadata test FR U16','U16',v_year,v_team.name,v_ts.age_group,v_year);
  ASSERT (SELECT name = 'Metadata test FR U16' FROM public.teams WHERE id = v_team.id);
  ASSERT (SELECT age_group = 'U16' AND display_name = 'Metadata test FR · U16 · ' || v_year
    AND season_id = v_ts.season_id AND team_id = v_team.id AND status = v_ts.status
    FROM public.team_seasons WHERE id = v_ts.id);
  SELECT jsonb_build_object(
    'other_teams',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.teams t WHERE id <> v_team.id),
    'other_seasons',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.team_seasons t WHERE id <> v_ts.id),
    'players',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.players t),
    'events',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.events t),
    'memberships',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id,team_season_id,role) FROM public.memberships t)
  ) INTO v_after;
  ASSERT v_before IS NOT DISTINCT FROM v_after, 'Linked records or other teams changed';
  -- Correct a season using a different shared year without renaming the original.
  SELECT count(*) INTO v_count FROM public.team_seasons;
  PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Metadata test FR KM','KM','2098/99','Metadata test FR U16','U16',v_year);
  ASSERT (SELECT display_name = 'Metadata test FR · KM · 2098/99' AND team_id = v_team.id FROM public.team_seasons WHERE id = v_ts.id);
  ASSERT (SELECT name = v_year FROM public.seasons WHERE id = v_ts.season_id);
  ASSERT (SELECT count(*) = v_count FROM public.team_seasons);
  -- Same-club duplicate names and an existing season cannot be overwritten.
  INSERT INTO public.teams(club_id,name) VALUES(v_team.club_id,'Metadata test other') RETURNING id INTO v_other_team;
  BEGIN
    PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Metadata test other','KM','2098/99','Metadata test FR KM','KM','2098/99');
    RAISE EXCEPTION 'Duplicate team name was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.seasons(name,active) VALUES('2097/98',false) RETURNING id INTO v_other_season;
  INSERT INTO public.team_seasons(team_id,season_id,status,age_group) VALUES(v_team.id,v_other_season,'draft','KM') RETURNING id INTO v_other_ts;
  BEGIN
    PERFORM public.admin_update_team_details(v_team.club_id,v_ts.id,'Metadata test FR KM','KM','2097/98','Metadata test FR KM','KM','2098/99');
    RAISE EXCEPTION 'Existing team-season was overwritten';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$$;
ROLLBACK;
