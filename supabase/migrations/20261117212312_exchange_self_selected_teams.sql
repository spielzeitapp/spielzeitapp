-- TEST: self-declared market teams are separate from SpielzeitApp roles/children.
create table private.exchange_member_teams (
 club_id uuid not null, user_id uuid not null, team_id uuid not null references public.teams(id) on delete cascade,
 primary key(club_id,user_id,team_id),
 foreign key(club_id,user_id) references private.exchange_members(club_id,user_id) on delete cascade
);
alter table private.exchange_member_teams enable row level security;
revoke all on private.exchange_member_teams from public,anon,authenticated;

create function private.exchange_team_options(c uuid,t text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 if not public.club_is_operable(c) or not (private.exchange_member(c) or exists(
  select 1 from private.exchange_invitations i where i.club_id=c and i.token=t and i.expires_at>now()
 )) then raise exception 'Bitte öffne eine gültige Vereinseinladung.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'age_group',x.age_group) order by
  nullif(regexp_replace(coalesce(x.age_group,x.name),'[^0-9]','','g'),'')::numeric nulls last,x.name),'[]'::jsonb)
 from public.teams x where x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id));
end $$;

create function private.exchange_join_with_teams(c uuid,t text,accepted boolean,ids uuid[]) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 -- Club lock serializes joins, link rotation and admin suspensions.
 perform 1 from public.clubs where id=c for update;
 if ids is null or cardinality(ids)<1 or cardinality(ids)>20 or array_position(ids,null) is not null then
  raise exception 'Bitte wähle mindestens eine Mannschaft.';
 end if;
 if exists(select 1 from unnest(ids) wanted(team_id) where not exists(select 1 from public.teams x
  where x.id=wanted.team_id and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id)))) then
  raise exception 'Diese Mannschaft gehört nicht zu diesem Vereinsmarkt.';
 end if;
 perform private.exchange_join(c,t,accepted);
 delete from private.exchange_member_teams where club_id=c and user_id=auth.uid();
 insert into private.exchange_member_teams(club_id,user_id,team_id) select c,auth.uid(),id from (select distinct unnest(ids) id) x;
 return true;
end $$;

-- Explicit suspensions override both invited and existing app-based access.
create or replace function private.exchange_member(c uuid) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and public.club_is_operable(c)
 and not exists(select 1 from private.exchange_members b where b.club_id=c and b.user_id=auth.uid() and b.revoked_at is not null)
 and (public.can_manage_club_venues(c) or exists(
 select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id
 join public.teams t on t.id=s.team_id where m.user_id=auth.uid() and s.status='active'
 and m.role::text in ('parent','trainer','co_trainer','head_coach','admin','fan')
 and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)))
 or exists(select 1 from public.player_guardians g
 join public.team_season_players r on r.player_id=g.player_id join public.team_seasons s on s.id=r.team_season_id
 join public.teams t on t.id=s.team_id where g.user_id=auth.uid() and s.status='active' and r.is_active is not false and r.left_at is null
 and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)))
 or exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is null));
$$;

create function private.exchange_members_list(c uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur die Vereinsverwaltung kann Mitglieder verwalten.'; end if;
 return (with app_teams as (
  select m.user_id,t.id,coalesce(nullif(s.age_group,''),nullif(t.age_group,''),t.name) label
  from public.memberships m join public.team_seasons s on s.id=m.team_season_id join public.teams t on t.id=s.team_id
  where s.status='active' and m.role::text in ('parent','trainer','co_trainer','head_coach','admin','fan')
  and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id))
  union
  select g.user_id,t.id,coalesce(nullif(s.age_group,''),nullif(t.age_group,''),t.name)
  from public.player_guardians g join public.team_season_players r on r.player_id=g.player_id
  join public.team_seasons s on s.id=r.team_season_id join public.teams t on t.id=s.team_id
  where s.status='active' and r.is_active is not false and r.left_at is null
  and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id))
 ), users as (select user_id from private.exchange_members where club_id=c union select user_id from app_teams), rows as (
  select u.user_id,coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(p.display_name,''),'Vereinsmitglied') name,
   m.joined_at,m.revoked_at,
   (select coalesce(jsonb_agg(distinct label),'[]'::jsonb) from (
    select coalesce(nullif(t.age_group,''),t.name) label from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c and mt.user_id=u.user_id
    union select label from app_teams where user_id=u.user_id
   ) labels) teams
  from users u left join public.profiles p on p.id=u.user_id left join private.exchange_members m on m.club_id=c and m.user_id=u.user_id
 ) select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name,'teams',teams,'joined_at',joined_at,'blocked',revoked_at is not null) order by name),'[]'::jsonb) from rows);
end $$;

create or replace function private.exchange_revoke(c uuid,u uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Keine Berechtigung.'; end if;
 if u=auth.uid() then raise exception 'Du kannst deinen eigenen Zugang hier nicht sperren.'; end if;
 perform 1 from public.clubs where id=c for update;
 if not exists(select 1 from jsonb_array_elements(private.exchange_members_list(c)) m where m->>'user_id'=u::text) then raise exception 'Dieses Mitglied gehört nicht zu diesem Vereinsmarkt.'; end if;
 insert into private.exchange_members(club_id,user_id,revoked_at) values(c,u,now())
 on conflict(club_id,user_id) do update set revoked_at=excluded.revoked_at;
end $$;

create function private.exchange_restore(c uuid,u uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Keine Berechtigung.'; end if;
 perform 1 from public.clubs where id=c for update;
 update private.exchange_members set revoked_at=null where club_id=c and user_id=u and revoked_at is not null;
 return found;
end $$;

create function public.exchange_team_options(p_club_id uuid,p_token text) returns jsonb language sql stable set search_path='' as $$select private.exchange_team_options(p_club_id,p_token);$$;
create function public.exchange_join(p_club_id uuid,p_token text,p_accepted boolean,p_team_ids uuid[]) returns boolean language sql set search_path='' as $$select private.exchange_join_with_teams(p_club_id,p_token,p_accepted,p_team_ids);$$;
create function public.exchange_members_list(p_club_id uuid) returns jsonb language sql stable set search_path='' as $$select private.exchange_members_list(p_club_id);$$;
create function public.exchange_restore(p_club_id uuid,p_user_id uuid) returns boolean language sql set search_path='' as $$select private.exchange_restore(p_club_id,p_user_id);$$;

revoke all on function private.exchange_team_options(uuid,text),private.exchange_join_with_teams(uuid,text,boolean,uuid[]),private.exchange_members_list(uuid),private.exchange_restore(uuid,uuid),public.exchange_team_options(uuid,text),public.exchange_join(uuid,text,boolean,uuid[]),public.exchange_members_list(uuid),public.exchange_restore(uuid,uuid) from public,anon;
grant execute on function private.exchange_team_options(uuid,text),private.exchange_join_with_teams(uuid,text,boolean,uuid[]),private.exchange_members_list(uuid),private.exchange_restore(uuid,uuid),public.exchange_team_options(uuid,text),public.exchange_join(uuid,text,boolean,uuid[]),public.exchange_members_list(uuid),public.exchange_restore(uuid,uuid) to authenticated;

create or replace function private.exchange_my_clubs() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('club_id',c.id,'name',c.name,'team_labels',(
  select coalesce(jsonb_agg(coalesce(nullif(t.age_group,''),t.name) order by t.name),'[]'::jsonb)
  from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c.id and mt.user_id=auth.uid()
 )) order by c.name),'[]'::jsonb)
 from public.clubs c where auth.uid() is not null and private.exchange_member(c.id);
$$;
