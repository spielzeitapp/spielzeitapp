-- Market-only membership: deliberately creates no team, parent or child access.
create table private.exchange_invitations (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 token text not null unique check(token ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table private.exchange_members (
 club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(club_id,user_id)
);
alter table private.exchange_invitations enable row level security;
alter table private.exchange_members enable row level security;
revoke all on private.exchange_invitations,private.exchange_members from public,anon,authenticated;
create index exchange_members_user on private.exchange_members(user_id);

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
 or exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is null)
);
$$;

create function private.exchange_invitation(c uuid,rotate boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i private.exchange_invitations;
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur die Vereinsverwaltung kann Einladungen erstellen.'; end if;
 -- Serialize generation/rotation for the same club.
 perform 1 from public.clubs where id=c for update;
 select * into i from private.exchange_invitations where club_id=c;
 if i.club_id is null or rotate or i.expires_at<=now() then
 insert into private.exchange_invitations(club_id,token,expires_at,created_by)
 values(c,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),now()+interval '90 days',auth.uid())
 on conflict(club_id) do update set token=excluded.token,expires_at=excluded.expires_at,created_by=excluded.created_by,updated_at=now()
 returning * into i;
 end if;
 return jsonb_build_object('token',i.token,'expires_at',i.expires_at);
end; $$;
create function public.exchange_invitation(p_club_id uuid,p_rotate boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.exchange_invitation(p_club_id,p_rotate);$$;

create function private.exchange_join(c uuid,t text,accepted boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 if accepted is not true then raise exception 'Bitte den Vereinsbeitritt bestätigen.'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and is_anonymous is not true) then raise exception 'Bitte zuerst deine E-Mail-Adresse bestätigen.'; end if;
 if not public.club_is_operable(c) then raise exception 'Dieser Vereinsmarkt ist nicht verfügbar.'; end if;
 -- Locks against concurrent rotation; revocation never silently reactivates.
 perform 1 from private.exchange_invitations where club_id=c and token=t and expires_at>now() for share;
 if not found then raise exception 'Diese Vereinseinladung ist ungültig oder abgelaufen. Bitte frage deinen Trainer nach dem aktuellen Link.'; end if;
 if exists(select 1 from private.exchange_members where club_id=c and user_id=auth.uid() and revoked_at is not null) then raise exception 'Dein Marktzugang ist gesperrt. Bitte wende dich an die Vereinsverwaltung.'; end if;
 insert into private.exchange_members(club_id,user_id) values(c,auth.uid()) on conflict do nothing;
 return true;
end; $$;
create function public.exchange_join(p_club_id uuid,p_token text,p_accepted boolean) returns boolean
language sql security invoker set search_path='' as $$select private.exchange_join(p_club_id,p_token,p_accepted);$$;

create function private.exchange_my_clubs() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('club_id',c.id,'name',c.name) order by c.name),'[]'::jsonb)
 from public.clubs c where auth.uid() is not null and private.exchange_member(c.id);
$$;
create function public.exchange_my_clubs() returns jsonb
language sql stable security invoker set search_path='' as $$select private.exchange_my_clubs();$$;

create function private.exchange_revoke(c uuid,u uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Keine Berechtigung.'; end if;
 update private.exchange_members set revoked_at=now() where club_id=c and user_id=u;
end; $$;
create function public.exchange_revoke(p_club_id uuid,p_user_id uuid) returns void
language sql security invoker set search_path='' as $$select private.exchange_revoke(p_club_id,p_user_id);$$;

revoke all on function private.exchange_invitation(uuid,boolean),private.exchange_join(uuid,text,boolean),private.exchange_my_clubs(),private.exchange_revoke(uuid,uuid),public.exchange_invitation(uuid,boolean),public.exchange_join(uuid,text,boolean),public.exchange_my_clubs(),public.exchange_revoke(uuid,uuid) from public,anon;
grant execute on function private.exchange_invitation(uuid,boolean),private.exchange_join(uuid,text,boolean),private.exchange_my_clubs(),private.exchange_revoke(uuid,uuid),public.exchange_invitation(uuid,boolean),public.exchange_join(uuid,text,boolean),public.exchange_my_clubs(),public.exchange_revoke(uuid,uuid) to authenticated;
