create or replace function private.exchange_active_team_age(team uuid) returns text
language sql stable set search_path = '' as $$
  select nullif(btrim(s.age_group), '')
  from public.team_seasons s
  where s.team_id = team and s.status = 'active' and s.archived_at is null
  order by s.created_at desc nulls last, s.id desc
  limit 1;
$$;

revoke all on function private.exchange_active_team_age(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.exchange_team_options(c uuid, t text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
 if not public.club_is_operable(c) or not (private.exchange_member(c) or exists(
  select 1 from private.exchange_invitations i where i.club_id=c and i.token=t and i.expires_at>now()
 ) or exists(select 1 from private.exchange_join_settings s join auth.users u on u.id=auth.uid()
  where s.club_id=c and s.self_join_enabled and u.email_confirmed_at is not null and u.is_anonymous is not true
  and not exists(select 1 from private.exchange_members b where b.club_id=c and b.user_id=u.id and b.revoked_at is not null)
 )) then raise exception 'Die Mannschaftsauswahl ist für diesen Vereinsmarkt nicht verfügbar. Bitte wende dich an die Vereinsverwaltung.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',case when season_age.label is not null then coalesce(nullif(custom.label,season_age.label),x.name) else x.name end,
  'age_group',coalesce(season_age.label,custom.label,x.age_group)) order by
  nullif(regexp_replace(coalesce(season_age.label,custom.label,x.age_group,x.name),'[^0-9]','','g'),'')::numeric nulls last,x.name),'[]'::jsonb)
 from public.teams x
 cross join lateral (select private.exchange_active_team_age(x.id) as label) season_age
 cross join lateral (select private.exchange_parent_team_label(c,x.id) as label) custom
 where (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id)) and private.exchange_parent_team_allowed(c,x.id));
end $function$;

CREATE OR REPLACE FUNCTION private.exchange_members_list(c uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not private.exchange_can_manage(c,'market') then raise exception 'Nur die Vereinsverwaltung kann Mitglieder verwalten.'; end if;
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
    select coalesce(private.exchange_active_team_age(t.id),nullif(t.age_group,''),t.name) label from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c and mt.user_id=u.user_id
    union select label from app_teams where user_id=u.user_id
   ) labels) teams
  from users u left join public.profiles p on p.id=u.user_id left join private.exchange_members m on m.club_id=c and m.user_id=u.user_id
 ) select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name,'teams',teams,'joined_at',joined_at,'blocked',revoked_at is not null) order by name),'[]'::jsonb) from rows);
end $function$;

CREATE OR REPLACE FUNCTION private.exchange_my_clubs()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('club_id',c.id,'name',c.name,'team_labels',(
  select coalesce(jsonb_agg(coalesce(private.exchange_active_team_age(t.id),nullif(t.age_group,''),t.name) order by t.name),'[]'::jsonb)
  from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c.id and mt.user_id=auth.uid()
 )) order by c.name),'[]'::jsonb)
 from public.clubs c where auth.uid() is not null and private.exchange_member(c.id);
$function$;
