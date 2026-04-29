-- Team hero photos: storage bucket + metadata table.

create table if not exists public.team_photos (
  team_season_id uuid primary key references public.team_seasons(id) on delete cascade,
  photo_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.team_photos enable row level security;

drop policy if exists "team_photos_select_team_members" on public.team_photos;
create policy "team_photos_select_team_members"
on public.team_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "team_photos_upsert_trainer_admin" on public.team_photos;
create policy "team_photos_upsert_trainer_admin"
on public.team_photos
for all
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "team_photos_public_read" on storage.objects;
create policy "team_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'team-photos');

drop policy if exists "team_photos_trainer_admin_insert" on storage.objects;
create policy "team_photos_trainer_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-photos'
  and exists (
    select 1
    from public.memberships m
    where m.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

drop policy if exists "team_photos_trainer_admin_update" on storage.objects;
create policy "team_photos_trainer_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'team-photos'
  and exists (
    select 1
    from public.memberships m
    where m.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
)
with check (
  bucket_id = 'team-photos'
  and exists (
    select 1
    from public.memberships m
    where m.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);

drop policy if exists "team_photos_trainer_admin_delete" on storage.objects;
create policy "team_photos_trainer_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'team-photos'
  and exists (
    select 1
    from public.memberships m
    where m.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('trainer', 'admin')
  )
);
