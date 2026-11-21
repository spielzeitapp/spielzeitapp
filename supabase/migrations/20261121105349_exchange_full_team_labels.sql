-- One full team identity for profile, selection, listings, messages and team cash.
create function private.exchange_full_team_label(c uuid,t uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare nm text; age text; custom text;
begin
 select btrim(x.name),coalesce(private.exchange_active_team_age(x.id),nullif(btrim(x.age_group),'')) into nm,age from public.teams x where x.id=t and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t));
 if not found then return null;end if;
 select nullif(btrim(e->>'label'),'') into custom from private.exchange_join_settings s cross join lateral jsonb_array_elements(s.parent_team_choices) e where s.club_id=c and e->>'id'=t::text limit 1;
 if custom is not null and custom !~* '^U\s*[0-9]+(-[0-9]+)?$' then return custom;end if;
 age:=coalesce(age,substring(nm from '(?i)\mU[0-9]+(?:-[0-9]+)?\M'));
 if age is null then return nm;end if;
 nm:=btrim(regexp_replace(nm,'(?i)\mU[0-9]+(?:-[0-9]+)?\M','','g'));
 nm:=regexp_replace(nm,'\s+',' ','g');
 return btrim(concat_ws(' ',nullif(nm,''),age));
end;$$;
revoke all on function private.exchange_full_team_label(uuid,uuid) from public,anon,authenticated;
create or replace function private.exchange_parent_team_label(c uuid,t uuid) returns text language sql stable security definer set search_path='' as $$ select private.exchange_full_team_label(c,t);$$;
-- TEST may predate the optional requester-label column; add it without changing consent.
alter table public.exchange_threads add column if not exists requester_team_label text not null default '';
create or replace function private.exchange_optional_team_label(c uuid,u uuid) returns text language sql stable set search_path='' as $$
 select case when exists(select 1 from auth.users a where a.id=u and a.raw_user_meta_data->'market_show_team'='true'::jsonb) then (
  select left(coalesce(string_agg(distinct label,' · ' order by label),''),300) from (
   select private.exchange_parent_team_label(c,t.id) label from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c and mt.user_id=u
   union select private.exchange_parent_team_label(c,t.id) from public.memberships m join public.team_seasons s on s.id=m.team_season_id join public.teams t on t.id=s.team_id where m.user_id=u and s.status='active' and m.role::text in ('parent','trainer','head_coach','co_trainer','admin','fan') and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id))
  ) labels
 ) else '' end;
$$;
revoke all on function private.exchange_optional_team_label(uuid,uuid) from public,anon;
do $requester$
declare d text;
begin
 d:=pg_get_functiondef('private.exchange_requester_label()'::regprocedure);
 if strpos(d,'requester_team_label')=0 then
 d:=replace(d,'return new;','select private.exchange_optional_team_label(l.club_id,new.requester_id) into new.requester_team_label from public.exchange_listings l where l.id=new.listing_id; return new;');
 execute d;
 end if;
end $requester$;
-- Preserve each RPC's existing membership/role checks; change only its label expression.
do $patch$
declare r record; d text;
begin
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('exchange_my_clubs','exchange_members_list','exchange_optional_team_label','exchange_team_options') loop
  d:=pg_get_functiondef(r.oid);
  d:=replace(d,'coalesce(private.exchange_active_team_age(t.id),nullif(t.age_group,'''') ,t.name)','private.exchange_parent_team_label(c,t.id)');
  if r.proname='exchange_my_clubs' then
   d:=replace(d,'coalesce(private.exchange_active_team_age(t.id),nullif(t.age_group,''''),t.name)','private.exchange_parent_team_label(c.id,t.id)');
  else
   d:=replace(d,'coalesce(private.exchange_active_team_age(t.id),nullif(t.age_group,''''),t.name)','private.exchange_parent_team_label(c,t.id)');
  end if;
  d:=replace(d,'coalesce(nullif(s.age_group,''''),nullif(t.age_group,''''),t.name)','private.exchange_parent_team_label(c,t.id)');
  d:=replace(d,'coalesce(nullif(t.age_group,''''),(select nullif(s.age_group,'''') from public.team_seasons s where s.team_id=t.id and s.status=''active'' limit 1),t.name)','private.exchange_parent_team_label(c,t.id)');
  d:=replace(d,'case when season_age.label is not null then coalesce(nullif(custom.label,season_age.label),x.name) else x.name end','private.exchange_parent_team_label(c,x.id)');
  if r.proname='exchange_optional_team_label' then d:=replace(d,'),50)', '),300)');end if;
  execute d;
 end loop;
end $patch$;
alter table public.exchange_listings drop constraint exchange_listings_team_label_check;
alter table public.exchange_listings add constraint exchange_listings_team_label_check check(length(team_label)<=300);
alter table public.exchange_threads drop constraint if exists exchange_threads_requester_team_label_check;
alter table public.exchange_threads add constraint exchange_threads_requester_team_label_check check(length(requester_team_label)<=300);
-- Repair only unambiguous age-only snapshots, never hidden or custom per-listing labels.
update public.exchange_listings l set team_label=private.exchange_optional_team_label(l.club_id,l.owner_id) where l.team_label ~* '^U[0-9]+$' and private.exchange_optional_team_label(l.club_id,l.owner_id)<>'' and private.exchange_optional_team_label(l.club_id,l.owner_id) not like '% · %';
update public.exchange_threads th set requester_team_label=private.exchange_optional_team_label(l.club_id,th.requester_id) from public.exchange_listings l where l.id=th.listing_id and th.requester_team_label ~* '^U[0-9]+$' and private.exchange_optional_team_label(l.club_id,th.requester_id)<>'' and private.exchange_optional_team_label(l.club_id,th.requester_id) not like '% · %';
