-- Spielerstatus (active/paused) + RLS-Haertung
-- Ziel: Keine Loeschung von Spielern, sondern pausieren/reaktivieren.

alter table public.players
  add column if not exists status text;

-- Backfill aus is_active fuer Bestandsdaten.
update public.players
set status = case when coalesce(is_active, true) then 'active' else 'paused' end
where status is null;

-- Fallback-Sauberkeit fuer evtl. ungueltige Werte.
update public.players
set status = 'active'
where status not in ('active', 'paused', 'archived');

alter table public.players
  alter column status set default 'active';

alter table public.players
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_status_check'
      and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_status_check
      check (status in ('active', 'paused', 'archived'));
  end if;
end $$;

create index if not exists idx_players_team_season_status
  on public.players(team_season_id, status);

-- is_active bleibt vorerst kompatibel.
update public.players
set is_active = (status = 'active')
where is_active is distinct from (status = 'active');

-- RLS fuer players haerten:
-- - Nicht-Staff nur aktive Spieler
-- - Staff/Admin aktive + pausierte Spieler im eigenen Team
alter table public.players enable row level security;

drop policy if exists players_select_active_only on public.players;
create policy players_select_active_only on public.players
  for select to authenticated
  using (
    coalesce(players.status, 'active') = 'active'
    and coalesce(players.is_active, true) = true
  );

drop policy if exists players_select_staff_with_paused on public.players;
create policy players_select_staff_with_paused on public.players
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.memberships ms
      where ms.user_id = auth.uid()
        and ms.team_season_id = players.team_season_id
        and ms.role::text in ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  );

drop policy if exists players_insert_staff on public.players;
create policy players_insert_staff on public.players
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.memberships ms
      where ms.user_id = auth.uid()
        and ms.team_season_id = players.team_season_id
        and ms.role::text in ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  );

drop policy if exists players_update_staff on public.players;
create policy players_update_staff on public.players
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.memberships ms
      where ms.user_id = auth.uid()
        and ms.team_season_id = players.team_season_id
        and ms.role::text in ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.memberships ms
      where ms.user_id = auth.uid()
        and ms.team_season_id = players.team_season_id
        and ms.role::text in ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  );

-- event_attendance: pausierte Spieler fuer Nicht-Staff ausblenden.
drop policy if exists event_attendance_select_team_members on public.event_attendance;
create policy event_attendance_select_team_members on public.event_attendance
  for select to authenticated
  using (
    exists (
      select 1
      from public.events e
      join public.memberships ms on ms.team_season_id = e.team_season_id
      where e.id = event_attendance.event_id
        and ms.user_id = auth.uid()
        and (
          ms.role::text in ('trainer', 'co_trainer', 'head_coach', 'admin')
          or exists (
            select 1
            from public.players p
            where p.id = event_attendance.player_id
              and coalesce(p.status, 'active') = 'active'
              and coalesce(p.is_active, true) = true
          )
        )
    )
  );

select pg_notify('pgrst', 'reload schema');
