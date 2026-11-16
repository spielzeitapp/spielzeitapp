-- Presentation access is separate from training/match management.
create table public.tournament_screen_directors (
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 assigned_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
alter table public.tournament_screen_directors enable row level security;
revoke all on public.tournament_screen_directors from anon,authenticated;
grant all on public.tournament_screen_directors to service_role;

-- Narrow definer helpers deliberately mediate this private, RLS-closed table.
create function public.tournament_screen_is_admin(p_event_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists (
  select 1 from public.events e join public.team_seasons ts on ts.id=e.team_season_id
  join public.teams t on t.id=ts.team_id
  where e.id=p_event_id and e.kind='tournament' and
   (public.is_platform_admin() or exists(select 1 from public.club_admin_assignments ca
    where ca.club_id=t.club_id and ca.user_id=auth.uid() and ca.is_active))
 );
$$;
create function public.tournament_screen_access(p_event_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('canManage',public.tournament_screen_is_admin(p_event_id),'canScreen',
 public.tournament_screen_is_admin(p_event_id) or (auth.uid() is not null and exists(
  select 1 from public.tournament_screen_directors d join public.events e on e.id=d.event_id
  join public.memberships m on m.team_season_id=e.team_season_id and m.user_id=d.user_id
  where d.event_id=p_event_id and d.user_id=auth.uid() and e.kind='tournament'
   and m.role::text in ('admin','trainer','head_coach','co_trainer')
 )));
$$;
create function public.tournament_screen_members(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.tournament_screen_is_admin(p_event_id) then raise exception 'Nur für Turnieradmins' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x order by x.label) from (
  select distinct m.user_id,coalesce(nullif(trim(p.display_name),''),nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Trainer') as label,
   exists(select 1 from public.tournament_screen_directors d where d.event_id=p_event_id and d.user_id=m.user_id) as assigned
  from public.events e join public.memberships m on m.team_season_id=e.team_season_id
  join public.profiles p on p.id=m.user_id where e.id=p_event_id
   and m.role::text in ('admin','trainer','head_coach','co_trainer')
 ) x),'[]'::jsonb);
end;
$$;
create function public.tournament_screen_assign(p_event_id uuid,p_user_id uuid,p_assigned boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.tournament_screen_is_admin(p_event_id) then raise exception 'Nur für Turnieradmins' using errcode='42501'; end if;
 if p_assigned is null or p_user_id is null then raise exception 'Ungültige Zuordnung' using errcode='22023'; end if;
 if p_assigned then
  if not exists(select 1 from public.events e join public.memberships m on m.team_season_id=e.team_season_id
   where e.id=p_event_id and m.user_id=p_user_id and m.role::text in ('admin','trainer','head_coach','co_trainer'))
  then raise exception 'Trainer gehört nicht zur Turniermannschaft' using errcode='22023'; end if;
  insert into public.tournament_screen_directors(event_id,user_id,assigned_by)
  values(p_event_id,p_user_id,auth.uid()) on conflict(event_id,user_id) do nothing;
 else
  delete from public.tournament_screen_directors where event_id=p_event_id and user_id=p_user_id;
 end if;
end;
$$;
revoke all on function public.tournament_screen_is_admin(uuid),public.tournament_screen_access(uuid),public.tournament_screen_members(uuid),public.tournament_screen_assign(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.tournament_screen_access(uuid) to anon,authenticated;
grant execute on function public.tournament_screen_members(uuid),public.tournament_screen_assign(uuid,uuid,boolean) to authenticated;
