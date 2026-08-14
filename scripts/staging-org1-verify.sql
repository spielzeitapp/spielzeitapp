select 'usc_clubs' as k, count(*)::text as v from clubs where btrim(name)='USC Rohrbach'
union all select 'u13_teams', count(*)::text from teams where btrim(name)='U13 TEST USC Rohrbach'
union all select 'u13_seasons_2026', count(*)::text
  from team_seasons ts join teams t on t.id=ts.team_id
  where t.name='U13 TEST USC Rohrbach' and ts.season_id='09e88815-bf57-40ac-8bd8-69113b9f65a5'
union all select 'rohrbach_venues', count(*)::text from venues where id='ec1ba01f-cc58-4c91-b524-463b510ca339'
union all select 'usc_rohrbach_grants', count(*)::text
  from team_season_training_venues g
  join team_seasons ts on ts.id=g.team_season_id
  join teams t on t.id=ts.team_id
  where t.name='U13 TEST USC Rohrbach' and g.venue_id='ec1ba01f-cc58-4c91-b524-463b510ca339' and g.is_active
union all select 'usc_stveit_grants', count(*)::text
  from team_season_training_venues g
  join team_seasons ts on ts.id=g.team_season_id
  join teams t on t.id=ts.team_id
  where t.name='U13 TEST USC Rohrbach' and g.venue_id='ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c'
union all select 'test_events', count(*)::text from events where notes like 'TEST U13%'
union all select 'admin_usc_memberships', count(*)::text
  from memberships m
  join team_seasons ts on ts.id=m.team_season_id
  join teams t on t.id=ts.team_id
  where t.name='U13 TEST USC Rohrbach' and m.user_id=(select id from profiles where is_admin limit 1);
