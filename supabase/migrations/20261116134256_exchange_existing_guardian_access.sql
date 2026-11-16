create or replace function private.exchange_member(c uuid) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and public.club_is_operable(c) and (
 public.can_manage_club_venues(c) or exists(
 select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id
 join public.teams t on t.id=s.team_id where m.user_id=auth.uid() and s.status='active'
 and m.role::text in ('parent','trainer','co_trainer','head_coach','admin','fan')
 and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)))
 or exists(
 select 1 from public.player_guardians g
 join public.team_season_players roster on roster.player_id=g.player_id
 join public.team_seasons s on s.id=roster.team_season_id
 join public.teams t on t.id=s.team_id
 where g.user_id=auth.uid() and s.status='active' and roster.is_active is not false and roster.left_at is null
 and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)))
);
$$;
revoke all on function private.exchange_member(uuid) from public,anon;
grant execute on function private.exchange_member(uuid) to authenticated;
