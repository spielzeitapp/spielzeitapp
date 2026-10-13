create table public.manager_communication_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 team_season_id uuid not null references public.team_seasons(id) on delete cascade,
 kind text not null check(kind in ('media','speaker')),
 title text not null check(length(title) between 1 and 160),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1000000),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create index manager_communication_drafts_owner_scope on public.manager_communication_drafts(owner_id,team_season_id,kind,updated_at desc);
alter table public.manager_communication_drafts enable row level security;
create policy owner_staff_drafts on public.manager_communication_drafts for all to authenticated
 using (
 owner_id=(select auth.uid()) and exists(
 select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=team_season_id and public.club_is_operable(t.club_id)
 and (public.can_manage_club_venues(t.club_id) or exists(
 select 1 from public.memberships m where m.team_season_id=ts.id and m.user_id=(select auth.uid()) and lower(m.role::text) in ('trainer','co_trainer','head_coach','head','admin')
 )))
 ) with check (
 owner_id=(select auth.uid()) and exists(
 select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=team_season_id and public.club_is_operable(t.club_id)
 and (public.can_manage_club_venues(t.club_id) or exists(
 select 1 from public.memberships m where m.team_season_id=ts.id and m.user_id=(select auth.uid()) and lower(m.role::text) in ('trainer','co_trainer','head_coach','head','admin')
 )))
 );
grant select,insert,update,delete on public.manager_communication_drafts to authenticated;
revoke all on public.manager_communication_drafts from anon;
create function public.guard_manager_communication_draft() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.owner_id<>old.owner_id or new.team_season_id<>old.team_season_id or new.kind<>old.kind then
 raise exception 'Entwurfszuordnung kann nicht geändert werden.'; end if;
 new.revision=old.revision+1; new.updated_at=now(); return new;
end;$$;
revoke execute on function public.guard_manager_communication_draft() from public,anon,authenticated;
create trigger manager_communication_draft_revision before update on public.manager_communication_drafts for each row execute function public.guard_manager_communication_draft();
create table public.communication_generation_limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default current_date,
 count integer not null default 0,
 primary key(user_id,day)
);
alter table public.communication_generation_limits enable row level security;
revoke all on public.communication_generation_limits from public,anon,authenticated;
create function public.reserve_communication_generation(p_user_id uuid) returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
 insert into public.communication_generation_limits(user_id,day,count) values(p_user_id,current_date,1)
 on conflict(user_id,day) do update set count=communication_generation_limits.count+1 where communication_generation_limits.count<20
 returning count into n;
 return n is not null;
end;$$;
revoke execute on function public.reserve_communication_generation(uuid) from public,anon,authenticated;
grant execute on function public.reserve_communication_generation(uuid) to service_role;
grant select,insert,update on public.communication_generation_limits to service_role;