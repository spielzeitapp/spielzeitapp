-- Opt-in, market-only self-join. No club is enabled by this generic migration.
create table private.exchange_join_settings (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 self_join_enabled boolean not null default false
);
alter table private.exchange_join_settings enable row level security;
revoke all on private.exchange_join_settings from public,anon,authenticated;

create or replace function private.exchange_team_options(c uuid,t text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 if not public.club_is_operable(c) or not (private.exchange_member(c) or exists(
  select 1 from private.exchange_invitations i where i.club_id=c and i.token=t and i.expires_at>now()
 ) or exists(select 1 from private.exchange_join_settings s join auth.users u on u.id=auth.uid()
  where s.club_id=c and s.self_join_enabled and u.email_confirmed_at is not null and u.is_anonymous is not true
  and not exists(select 1 from private.exchange_members b where b.club_id=c and b.user_id=u.id and b.revoked_at is not null)
 )) then raise exception 'Die Mannschaftsauswahl ist für diesen Vereinsmarkt nicht verfügbar. Bitte wende dich an die Vereinsverwaltung.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'age_group',x.age_group) order by
  nullif(regexp_replace(coalesce(x.age_group,x.name),'[^0-9]','','g'),'')::numeric nulls last,x.name),'[]'::jsonb)
 from public.teams x where x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id));
end $$;

create function private.exchange_self_join(c uuid,accepted boolean,ids uuid[]) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 if accepted is not true then raise exception 'Bitte bestätige, dass deine Familie zum Verein gehört.'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and is_anonymous is not true) then raise exception 'Bitte zuerst deine E-Mail-Adresse bestätigen.'; end if;
 if not public.club_is_operable(c) then raise exception 'Dieser Vereinsmarkt ist nicht verfügbar.'; end if;
 -- Same lock order as invited joins, rotations and suspensions; a suspension always wins.
 perform 1 from public.clubs where id=c for update;
 perform 1 from private.exchange_join_settings where club_id=c and self_join_enabled for share;
 if not found then raise exception 'Der direkte Beitritt ist für diesen Vereinsmarkt nicht freigegeben. Bitte wende dich an die Vereinsverwaltung.'; end if;
 if exists(select 1 from private.exchange_members where club_id=c and user_id=auth.uid() and revoked_at is not null) then raise exception 'Dein Marktzugang ist gesperrt. Bitte wende dich an die Vereinsverwaltung.'; end if;
 if ids is null or cardinality(ids)<1 or cardinality(ids)>20 or array_position(ids,null) is not null then raise exception 'Bitte wähle mindestens eine Mannschaft.'; end if;
 if exists(select 1 from unnest(ids) wanted(team_id) where not exists(select 1 from public.teams x
  where x.id=wanted.team_id and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id)))) then raise exception 'Diese Mannschaft gehört nicht zu diesem Vereinsmarkt.'; end if;
 insert into private.exchange_members(club_id,user_id) values(c,auth.uid()) on conflict do nothing;
 delete from private.exchange_member_teams where club_id=c and user_id=auth.uid();
 insert into private.exchange_member_teams(club_id,user_id,team_id) select c,auth.uid(),id from (select distinct unnest(ids) id) x;
 return true;
end $$;
create function public.exchange_self_join(p_club_id uuid,p_accepted boolean,p_team_ids uuid[]) returns boolean
language sql security invoker set search_path='' as $$select private.exchange_self_join(p_club_id,p_accepted,p_team_ids);$$;
revoke all on function private.exchange_self_join(uuid,boolean,uuid[]),public.exchange_self_join(uuid,boolean,uuid[]) from public,anon;
grant execute on function private.exchange_self_join(uuid,boolean,uuid[]),public.exchange_self_join(uuid,boolean,uuid[]) to authenticated;
