-- Controller and camera authenticate as the same authorised Manager account.
create table public.player_photo_remote_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 team_season_id uuid not null references public.team_seasons(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '2 hours',
 camera_id uuid,
 camera_seen_at timestamptz,
 command jsonb,
 ack uuid,
 state jsonb,
 check(expires_at>created_at and expires_at<=created_at+interval '2 hours'),
 check(command is null or (jsonb_typeof(command)='object' and octet_length(command::text)<2000)),
 check(state is null or (jsonb_typeof(state)='object' and octet_length(state::text)<900000))
);
alter table public.player_photo_remote_sessions enable row level security;
revoke all on public.player_photo_remote_sessions from anon,authenticated;
grant select,insert,delete on public.player_photo_remote_sessions to authenticated;
-- A client cannot move a session to another owner, season or expiry.
grant update(camera_id,camera_seen_at,command,ack,state) on public.player_photo_remote_sessions to authenticated;
create policy photo_remote_read on public.player_photo_remote_sessions for select to authenticated
 using(owner_id=(select auth.uid()) and expires_at>now() and public.can_manage_team_staff(team_season_id));
create policy photo_remote_insert on public.player_photo_remote_sessions for insert to authenticated
 with check(owner_id=(select auth.uid()) and expires_at>now() and public.can_manage_team_staff(team_season_id)
 and exists(select 1 from public.team_seasons ts where ts.id=team_season_id and ts.status in ('active','draft')));
create policy photo_remote_update on public.player_photo_remote_sessions for update to authenticated
 using(owner_id=(select auth.uid()) and expires_at>now() and public.can_manage_team_staff(team_season_id))
 with check(owner_id=(select auth.uid()) and expires_at>now() and public.can_manage_team_staff(team_season_id)
 and exists(select 1 from public.team_seasons ts where ts.id=team_season_id and ts.status in ('active','draft')));
create policy photo_remote_delete on public.player_photo_remote_sessions for delete to authenticated using(owner_id=(select auth.uid()));
create index player_photo_remote_owner on public.player_photo_remote_sessions(owner_id,expires_at);
-- Inactive sessions become inaccessible after expiry; a scheduled job removes
-- expired thumbnails. Closing the controller deletes the session immediately.
notify pgrst,'reload schema';
select cron.schedule('player-photo-remote-expiry','*/10 * * * *','delete from public.player_photo_remote_sessions where expires_at<=now()');
