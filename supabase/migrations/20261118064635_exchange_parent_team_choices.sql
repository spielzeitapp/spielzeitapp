-- Market-only selection settings; does not create or remove app memberships.
alter table private.exchange_join_settings add column parent_team_choices jsonb default null,
 add column parent_team_version integer not null default 0;
alter table private.exchange_join_settings add constraint exchange_parent_choices_array check(parent_team_choices is null or jsonb_typeof(parent_team_choices)='array');
create function private.exchange_parent_team_allowed(c uuid,t uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.exchange_join_settings where club_id=c and parent_team_choices is not null)
 or exists(select 1 from private.exchange_join_settings s cross join lateral jsonb_array_elements(s.parent_team_choices) e where s.club_id=c and e->>'id'=t::text);
$$;
create function private.exchange_parent_team_label(c uuid,t uuid) returns text
language sql stable security definer set search_path='' as $$
 select nullif(btrim(e->>'label'),'') from private.exchange_join_settings s cross join lateral jsonb_array_elements(s.parent_team_choices) e where s.club_id=c and e->>'id'=t::text limit 1;
$$;
revoke all on function private.exchange_parent_team_allowed(uuid,uuid),private.exchange_parent_team_label(uuid,uuid) from public,anon,authenticated;

create function private.exchange_parent_teams_admin(c uuid,choices jsonb,expected integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer; normalized jsonb; e jsonb; team uuid; label text;
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur die Vereinsverwaltung darf diese Auswahl bearbeiten.'; end if;
 perform 1 from public.clubs where id=c for update;
 insert into private.exchange_join_settings(club_id) values(c) on conflict do nothing;
 select parent_team_version into current_version from private.exchange_join_settings where club_id=c;
 if choices is not null then
  if expected is null or expected<>current_version then raise exception 'Die Auswahl wurde inzwischen geändert. Bitte neu laden.' using errcode='40001'; end if;
  if jsonb_typeof(choices)<>'array' then raise exception 'Ungültige Mannschaftsauswahl.'; end if;
  if jsonb_array_length(choices)>200 then raise exception 'Zu viele Mannschaften.'; end if;
  normalized='[]'::jsonb;
  for e in select value from jsonb_array_elements(choices) loop
   if jsonb_typeof(e)<>'object' or jsonb_typeof(e->'id') is distinct from 'string' or (e ? 'label' and jsonb_typeof(e->'label') not in ('string','null')) then raise exception 'Ungültige Mannschaft oder Bezeichnung.'; end if;
   team=(e->>'id')::uuid; label=nullif(btrim(e->>'label'),'');
   if char_length(label)>60 or label ~ '[[:cntrl:]]' then raise exception 'Der Anzeigename darf höchstens 60 Zeichen enthalten.'; end if;
   if not exists(select 1 from public.teams x where x.id=team and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id))) then raise exception 'Diese Mannschaft gehört nicht zu diesem Vereinsmarkt.'; end if;
   if exists(select 1 from jsonb_array_elements(normalized) n where n->>'id'=team::text) then raise exception 'Eine Mannschaft wurde doppelt ausgewählt.'; end if;
   normalized=normalized||jsonb_build_array(jsonb_build_object('id',team,'label',label));
  end loop;
  update private.exchange_join_settings set parent_team_choices=normalized,parent_team_version=parent_team_version+1 where club_id=c returning parent_team_version into current_version;
 end if;
 return jsonb_build_object('version',current_version,'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'age_group',x.age_group,'enabled',private.exchange_parent_team_allowed(c,x.id),'label',private.exchange_parent_team_label(c,x.id)) order by x.age_group nulls last,x.name),'[]'::jsonb) from public.teams x where x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id)));
end $$;
create function public.exchange_parent_teams_admin(p_club_id uuid,p_choices jsonb default null,p_expected integer default null) returns jsonb
language sql security invoker set search_path='' as $$select private.exchange_parent_teams_admin(p_club_id,p_choices,p_expected);$$;
revoke all on function private.exchange_parent_teams_admin(uuid,jsonb,integer),public.exchange_parent_teams_admin(uuid,jsonb,integer) from public,anon;
grant execute on function private.exchange_parent_teams_admin(uuid,jsonb,integer),public.exchange_parent_teams_admin(uuid,jsonb,integer) to authenticated;
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
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'age_group',coalesce(private.exchange_parent_team_label(c,x.id),x.age_group)) order by
  nullif(regexp_replace(coalesce(x.age_group,x.name),'[^0-9]','','g'),'')::numeric nulls last,x.name),'[]'::jsonb)
 from public.teams x where (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=x.id)) and private.exchange_parent_team_allowed(c,x.id));
end $$;


create or replace function private.exchange_self_join(c uuid,accepted boolean,ids uuid[]) returns boolean
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
 if exists(select 1 from unnest(ids) chosen(team_id) where not private.exchange_parent_team_allowed(c,chosen.team_id)) then raise exception 'Diese Mannschaft ist für die Elternauswahl nicht freigegeben. Bitte lade die Auswahl neu.'; end if;
 insert into private.exchange_members(club_id,user_id) values(c,auth.uid()) on conflict do nothing;
 delete from private.exchange_member_teams where club_id=c and user_id=auth.uid();
 insert into private.exchange_member_teams(club_id,user_id,team_id) select c,auth.uid(),id from (select distinct unnest(ids) id) x;
 return true;
end $$;

create or replace function private.exchange_join_with_teams(c uuid,t text,accepted boolean,ids uuid[]) returns boolean
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
 if exists(select 1 from unnest(ids) chosen(team_id) where not private.exchange_parent_team_allowed(c,chosen.team_id)) then raise exception 'Diese Mannschaft ist für die Elternauswahl nicht freigegeben. Bitte lade die Auswahl neu.'; end if;
 perform private.exchange_join(c,t,accepted);
 delete from private.exchange_member_teams where club_id=c and user_id=auth.uid();
 insert into private.exchange_member_teams(club_id,user_id,team_id) select c,auth.uid(),id from (select distinct unnest(ids) id) x;
 return true;
end $$;

notify pgrst,'reload schema';
