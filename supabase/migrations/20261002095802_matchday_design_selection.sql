-- Uses existing staff write/team member read RLS; no privilege changes.
alter table public.event_feed_settings
  add column if not exists matchday_design jsonb not null default '{"template":"clean","playerId":null,"imageUrl":null,"playerName":null}'::jsonb;
