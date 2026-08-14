select 'clubs' as k, count(*)::text as v from clubs
union all select 'teams', count(*)::text from teams
union all select 'team_seasons', count(*)::text from team_seasons
union all select 'memberships', count(*)::text from memberships
union all select 'venues', count(*)::text from venues
union all select 'fields', count(*)::text from fields
union all select 'zones', count(*)::text from zones
union all select 'events', count(*)::text from events
union all select 'platform_admins', count(*)::text from profiles where is_admin is true
union all select 'training_venue_grants', count(*)::text from team_season_training_venues
union all select 'event_field_assignments', count(*)::text from event_field_assignments;
