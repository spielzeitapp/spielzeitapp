-- Player avatars: storage bucket + players.avatar_url
-- Scope: Team/Kader UI only

alter table public.players
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('player-avatars', 'player-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "player_avatars_public_read" on storage.objects;
create policy "player_avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'player-avatars');

drop policy if exists "player_avatars_trainer_admin_insert" on storage.objects;
create policy "player_avatars_trainer_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'player-avatars'
  and exists (
    select 1
    from public.players p
    join public.memberships m on m.team_season_id = p.team_season_id
    where p.id::text = split_part(split_part(name, '/', 2), '.', 1)
      and p.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

drop policy if exists "player_avatars_trainer_admin_update" on storage.objects;
create policy "player_avatars_trainer_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'player-avatars'
  and exists (
    select 1
    from public.players p
    join public.memberships m on m.team_season_id = p.team_season_id
    where p.id::text = split_part(split_part(name, '/', 2), '.', 1)
      and p.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
)
with check (
  bucket_id = 'player-avatars'
  and exists (
    select 1
    from public.players p
    join public.memberships m on m.team_season_id = p.team_season_id
    where p.id::text = split_part(split_part(name, '/', 2), '.', 1)
      and p.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

drop policy if exists "player_avatars_trainer_admin_delete" on storage.objects;
create policy "player_avatars_trainer_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'player-avatars'
  and exists (
    select 1
    from public.players p
    join public.memberships m on m.team_season_id = p.team_season_id
    where p.id::text = split_part(split_part(name, '/', 2), '.', 1)
      and p.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

