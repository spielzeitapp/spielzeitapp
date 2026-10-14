create table public.club_communication_access (
 club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 speaker_enabled boolean not null default false,
 music_enabled boolean not null default false,
 primary key(club_id,user_id)
);
alter table public.club_communication_access enable row level security;
revoke all on public.club_communication_access from public,anon,authenticated;
grant select,insert,update,delete on public.club_communication_access to authenticated;
create policy communication_access_read on public.club_communication_access for select to authenticated
 using(user_id=(select auth.uid()) or public.can_manage_club_venues(club_id));
create policy communication_access_insert on public.club_communication_access for insert to authenticated
 with check(public.can_manage_club_venues(club_id));
create policy communication_access_update on public.club_communication_access for update to authenticated
 using(public.can_manage_club_venues(club_id)) with check(public.can_manage_club_venues(club_id));
create policy communication_access_delete on public.club_communication_access for delete to authenticated
 using(public.can_manage_club_venues(club_id));
create function public.can_use_club_communications(p_club_id uuid,p_module text) returns boolean
 language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and public.club_is_operable(p_club_id)
 and p_module in ('speaker','music') and (
 public.can_manage_club_venues(p_club_id) or (
 exists(select 1 from public.club_communication_access a where a.club_id=p_club_id and a.user_id=(select auth.uid())
 and case p_module when 'speaker' then a.speaker_enabled else a.music_enabled end)
 and exists(select 1 from public.memberships m join public.team_seasons ts on ts.id=m.team_season_id
 join public.teams t on t.id=ts.team_id where t.club_id=p_club_id and m.user_id=(select auth.uid())
 and lower(m.role::text) in ('trainer','co_trainer','head_coach','head','admin'))));
$$;
revoke all on function public.can_use_club_communications(uuid,text) from public,anon;
grant execute on function public.can_use_club_communications(uuid,text) to authenticated;
create function public.get_my_communication_access(p_team_season_id uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_build_object('speaker',public.can_use_club_communications(t.club_id,'speaker'),
 'music',public.can_use_club_communications(t.club_id,'music'),'admin',public.can_manage_club_venues(t.club_id))
 from public.team_seasons ts join public.teams t on t.id=ts.team_id where ts.id=p_team_season_id
 and (public.can_manage_club_venues(t.club_id) or exists(select 1 from public.memberships m
 where m.team_season_id=ts.id and m.user_id=(select auth.uid())
 and lower(m.role::text) in ('trainer','co_trainer','head_coach','head','admin')))),
 '{"speaker":false,"music":false,"admin":false}'::jsonb);
$$;
revoke all on function public.get_my_communication_access(uuid) from public,anon;
grant execute on function public.get_my_communication_access(uuid) to authenticated;
create or replace function public.can_access_speaker_audio(p_club text) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.teams t where t.club_id::text=p_club
 and public.can_use_club_communications(t.club_id,'music'));
$$;
create policy speaker_draft_requires_access on public.manager_communication_drafts as restrictive for all to authenticated
 using(kind<>'speaker' or exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=team_season_id and public.can_use_club_communications(t.club_id,'speaker')))
 with check(kind<>'speaker' or exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=team_season_id and public.can_use_club_communications(t.club_id,'speaker')));
