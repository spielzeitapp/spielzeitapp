-- Unique constraint for (user_id, team_season_id) so Edge Function setup-admin can use upsert with onConflict
alter table public.memberships
add constraint memberships_user_teamseason_unique
unique (user_id, team_season_id);
