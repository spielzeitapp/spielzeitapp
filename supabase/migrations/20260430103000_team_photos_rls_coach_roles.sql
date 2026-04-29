-- Team photos: RLS aligned with coach roles on memberships (trainer, co_trainer, head_coach).
-- Replaces trainer/admin-only policies that blocked head_coach / co_trainer.

create table if not exists public.team_photos (
  team_season_id uuid primary key references public.team_seasons(id) on delete cascade,
  photo_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.team_photos enable row level security;

drop policy if exists "team_photos_select_team_members" on public.team_photos;
drop policy if exists "team_photos_upsert_trainer_admin" on public.team_photos;
drop policy if exists "team_photos_read" on public.team_photos;
drop policy if exists "team_photos_insert" on public.team_photos;
drop policy if exists "team_photos_update" on public.team_photos;

create policy "team_photos_read"
on public.team_photos
for select
to authenticated
using (true);

create policy "team_photos_insert"
on public.team_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);

create policy "team_photos_update"
on public.team_photos
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.team_season_id = team_photos.team_season_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);

insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "team_photos_trainer_admin_insert" on storage.objects;
drop policy if exists "team_photos_trainer_admin_update" on storage.objects;
drop policy if exists "team_photos_trainer_admin_delete" on storage.objects;

create policy "team_photos_coach_insert"
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
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);

create policy "team_photos_coach_update"
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
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
)
with check (
  bucket_id = 'team-photos'
  and exists (
    select 1
    from public.memberships m
    where m.team_season_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);

create policy "team_photos_coach_delete"
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
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);
