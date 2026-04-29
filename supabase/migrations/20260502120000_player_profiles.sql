-- Player profile metadata (birthdate); separate from public.players roster row.

create table if not exists public.player_profiles (
  player_id uuid primary key references public.players (id) on delete cascade,
  birthdate date,
  updated_at timestamptz not null default now()
);

create index if not exists player_profiles_player_id_idx on public.player_profiles (player_id);

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_select_authenticated" on public.player_profiles;
create policy "player_profiles_select_authenticated"
on public.player_profiles
for select
to authenticated
using (true);

drop policy if exists "player_profiles_insert_coach" on public.player_profiles;
create policy "player_profiles_insert_coach"
on public.player_profiles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.players pl
    join public.memberships m on m.team_season_id = pl.team_season_id
    where pl.id = player_profiles.player_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);

drop policy if exists "player_profiles_update_coach" on public.player_profiles;
create policy "player_profiles_update_coach"
on public.player_profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.players pl
    join public.memberships m on m.team_season_id = pl.team_season_id
    where pl.id = player_profiles.player_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
)
with check (
  exists (
    select 1
    from public.players pl
    join public.memberships m on m.team_season_id = pl.team_season_id
    where pl.id = player_profiles.player_id
      and m.user_id = auth.uid()
      and m.role in ('trainer', 'co_trainer', 'head_coach')
  )
);
