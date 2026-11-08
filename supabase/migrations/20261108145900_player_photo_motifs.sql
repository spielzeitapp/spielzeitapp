-- Additional photos never replace the player's shared profile photograph.
create table public.player_photo_motifs (
 team_season_id uuid not null references public.team_seasons(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 purpose text not null check (purpose in ('matchday','celebration')),
 original_url text not null,
 cutout_url text,
 layout jsonb check (public.valid_player_photo_layout(layout)),
 revision uuid not null default gen_random_uuid(),
 primary key (team_season_id,player_id,purpose),
 check (original_url ~ ('^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/player-avatars/'||team_season_id||'/'||player_id||'[.]'||purpose||'[.][a-z0-9-]+[.]jpg$')),
 check (cutout_url is null or cutout_url ~ ('^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/player-avatars/'||team_season_id||'/'||player_id||'[.]'||purpose||'[.][a-z0-9-]+[.]png$'))
);
alter table public.player_photo_motifs enable row level security;
revoke all on public.player_photo_motifs from anon,authenticated;
grant select,insert,update on public.player_photo_motifs to authenticated;
create policy motifs_read on public.player_photo_motifs for select to authenticated
 using (public.can_manage_team_staff(team_season_id));
create policy motifs_insert on public.player_photo_motifs for insert to authenticated
 with check (public.can_manage_team_staff(team_season_id) and public.player_in_team_season(player_id,team_season_id)
 and exists(select 1 from public.team_seasons ts where ts.id=team_season_id and ts.status in ('active','draft')));
create policy motifs_update on public.player_photo_motifs for update to authenticated
 using (public.can_manage_team_staff(team_season_id))
 with check (public.can_manage_team_staff(team_season_id) and public.player_in_team_season(player_id,team_season_id)
 and exists(select 1 from public.team_seasons ts where ts.id=team_season_id and ts.status in ('active','draft')));
-- Unique object names keep replaced pictures intact. Existing Storage policies
-- validate the UUID preceding the first dot, then the team-season membership.
notify pgrst,'reload schema';
