-- Registration evidence is server-timestamped and private. User metadata here is
-- a display preference only; it never grants membership or another privilege.
create table private.market_terms_acceptances (
 user_id uuid not null references auth.users(id) on delete cascade,
 terms_version text not null check(terms_version='2026-11-17'),
 accepted_at timestamptz not null default now(),
 primary key(user_id,terms_version)
);
alter table private.market_terms_acceptances enable row level security;
revoke all on private.market_terms_acceptances from public,anon,authenticated;

alter table public.exchange_threads add column requester_team_label text not null default '' check(length(requester_team_label)<=50);

create function private.exchange_optional_team_label(c uuid,u uuid) returns text
language sql stable set search_path='' as $$
 select case when exists(select 1 from auth.users a where a.id=u and a.raw_user_meta_data->'market_show_team'='true'::jsonb) then (
  select left(coalesce(string_agg(distinct label,' · ' order by label),''),50) from (
   select coalesce(nullif(t.age_group,''),(select nullif(s.age_group,'') from public.team_seasons s where s.team_id=t.id and s.status='active' limit 1),t.name) label
   from private.exchange_member_teams mt join public.teams t on t.id=mt.team_id where mt.club_id=c and mt.user_id=u
   union
   select coalesce(nullif(s.age_group,''),nullif(t.age_group,''),t.name)
   from public.memberships m join public.team_seasons s on s.id=m.team_season_id join public.teams t on t.id=s.team_id
   where m.user_id=u and s.status='active' and m.role::text in ('parent','trainer','head_coach','co_trainer','admin','fan')
   and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id))
  ) labels
 ) else '' end;
$$;
revoke all on function private.exchange_optional_team_label(uuid,uuid) from public,anon,authenticated;

create or replace function private.exchange_requester_label() returns trigger language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 select left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.display_name),' ',1),''),'Vereinsmitglied'),50) into new.requester_label from public.profiles p where p.id=new.requester_id;
 new.requester_label:=coalesce(new.requester_label,'Vereinsmitglied');
 select l.club_id into c from public.exchange_listings l where l.id=new.listing_id;
 new.requester_team_label:=private.exchange_optional_team_label(c,new.requester_id);
 return new;
end $$;
revoke all on function private.exchange_requester_label() from public,anon,authenticated;

create function private.market_registration_choices() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'auth_entry'='vereinsmarkt' and new.raw_user_meta_data->>'market_terms_version'='2026-11-17' then
  insert into private.market_terms_acceptances(user_id,terms_version) values(new.id,'2026-11-17') on conflict do nothing;
 end if;
 if tg_op='UPDATE' and new.raw_user_meta_data->'market_show_team'='false'::jsonb and old.raw_user_meta_data->'market_show_team' is distinct from 'false'::jsonb then
  update public.exchange_threads set requester_team_label='' where requester_id=new.id and requester_team_label<>'';
  update public.exchange_listings set team_label='' where owner_id=new.id and team_label<>'';
 end if;
 return new;
end $$;
revoke all on function private.market_registration_choices() from public,anon,authenticated;
create trigger market_registration_choices after insert or update of raw_user_meta_data on auth.users for each row execute function private.market_registration_choices();
notify pgrst,'reload schema';
