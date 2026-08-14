select
  (select count(*)::int from clubs) as clubs,
  (select count(*)::int from teams) as teams,
  (select count(*)::int from team_seasons) as team_seasons,
  (select count(*)::int from venues) as venues,
  (select count(*)::int from venue_fields) as fields,
  (select count(*)::int from venue_field_zones where is_active) as zones_active,
  (select count(*)::int from events) as events,
  (select count(*)::int from event_field_assignments) as assignments,
  (select count(*)::int from team_season_training_venues) as training_allowlists;
