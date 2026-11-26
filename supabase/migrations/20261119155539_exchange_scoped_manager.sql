create table if not exists private.exchange_manager_assignments(
 club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 manage_market boolean not null default false,
 manage_teams boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),primary key(club_id,user_id)
);
alter table private.exchange_manager_assignments enable row level security;
revoke all on private.exchange_manager_assignments from public,anon,authenticated;
create or replace function private.exchange_can_manage(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('market','teams') and auth.uid() is not null and public.club_is_operable(c) and exists(select 1 from auth.users a where a.id=auth.uid() and a.is_anonymous is not true) and
 (public.can_manage_club_venues(c) or (not exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is not null) and exists(select 1 from private.exchange_manager_assignments r where r.club_id=c and r.user_id=auth.uid() and case cap when 'market' then r.manage_market when 'teams' then r.manage_teams else false end)));
$$;
create or replace function public.can_manage_exchange(p_club_id uuid,p_capability text default 'market') returns boolean language sql stable security invoker set search_path='' as $$select private.exchange_can_manage(p_club_id,p_capability);$$;
create or replace function private.exchange_manager_clubs() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'market',private.exchange_can_manage(c.id,'market'),'teams',private.exchange_can_manage(c.id,'teams'),'admin',public.can_manage_club_venues(c.id)) order by c.name),'[]'::jsonb) from public.clubs c where auth.uid() is not null and (private.exchange_can_manage(c.id,'market') or private.exchange_can_manage(c.id,'teams'));
$$;
create or replace function public.exchange_manager_clubs() returns jsonb language sql stable security invoker set search_path='' as $$select private.exchange_manager_clubs();$$;
create or replace function private.exchange_manager_candidates(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur die Vereinsverwaltung darf Rechte vergeben.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(p.display_name,''),'Vereinsmitglied'),'market',coalesce(r.manage_market,false),'teams',coalesce(r.manage_teams,false)) order by p.last_name,p.first_name),'[]'::jsonb)
 from auth.users u left join public.profiles p on p.id=u.id left join private.exchange_manager_assignments r on r.club_id=c and r.user_id=u.id
 where u.is_anonymous is not true and (r.user_id is not null or exists(select 1 from private.exchange_members e where e.club_id=c and e.user_id=u.id and e.revoked_at is null) or exists(select 1 from public.memberships m join public.team_seasons ts on ts.id=m.team_season_id join public.teams t on t.id=ts.team_id where m.user_id=u.id and (t.club_id=c or exists(select 1 from public.exchange_partner_teams x where x.club_id=c and x.team_id=t.id))) or exists(select 1 from public.club_admin_assignments ca where ca.club_id=c and ca.user_id=u.id and ca.is_active)));
end $$;
create or replace function public.exchange_manager_candidates(p_club_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.exchange_manager_candidates(p_club_id);$$;
create or replace function private.exchange_manager_assign(c uuid,u uuid,m boolean,t boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur die Vereinsverwaltung darf Rechte vergeben.'; end if;
 perform 1 from public.clubs where id=c for update;
 if not exists(select 1 from jsonb_array_elements(private.exchange_manager_candidates(c)) e where e->>'id'=u::text) then raise exception 'Die Person muss bereits zu diesem Verein gehören.'; end if;
 insert into private.exchange_manager_assignments(club_id,user_id,manage_market,manage_teams,updated_by) values(c,u,coalesce(m,false),coalesce(t,false),auth.uid()) on conflict(club_id,user_id) do update set manage_market=excluded.manage_market,manage_teams=excluded.manage_teams,updated_by=excluded.updated_by,updated_at=now();
 return true;
end $$;
create or replace function public.exchange_manager_assign(p_club_id uuid,p_user_id uuid,p_market boolean,p_teams boolean) returns boolean language sql security invoker set search_path='' as $$select private.exchange_manager_assign(p_club_id,p_user_id,p_market,p_teams);$$;
-- Delegate only market functions. General club, training and account roles stay untouched.
do $migration$
declare f record;body text;cap text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('exchange_member','exchange_invitation','exchange_members_list','exchange_restore','exchange_revoke','exchange_parent_teams_admin') loop
  if position('private.exchange_can_manage' in pg_get_functiondef(f.oid))>0 then continue; end if;
  cap:=case when f.proname='exchange_parent_teams_admin' then 'teams' else 'market' end;
  body:=replace(pg_get_functiondef(f.oid),'public.can_manage_club_venues(c)',format('private.exchange_can_manage(c,%L)',cap));
  if f.proname='exchange_revoke' then
   body:=replace(body,'perform 1 from public.clubs where id=c for update;', $guard$
    if not public.can_manage_club_venues(c) and (exists(select 1 from public.user_roles r where r.user_id=u and r.role::text='admin') or exists(select 1 from public.club_admin_assignments ca where ca.club_id=c and ca.user_id=u and ca.is_active) or exists(select 1 from private.exchange_manager_assignments a where a.club_id=c and a.user_id=u and (a.manage_market or a.manage_teams))) then raise exception 'Verantwortliche kann nur die Vereinsverwaltung sperren.'; end if;
    perform 1 from public.clubs where id=c for update;
   $guard$);
  end if;
  execute body;
 end loop;
end $migration$;
create or replace function private.exchange_manager_create_team(c uuid,n text,a text) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;v_name text:=nullif(btrim(n),'');age text:=nullif(btrim(a),'');
begin
 if not private.exchange_can_manage(c,'teams') then raise exception 'Keine Berechtigung für Teams.'; end if;
 if v_name is null or char_length(v_name)>80 or age is null or age!~'^U[0-9]{1,2}$' then raise exception 'Bitte Teamname und Altersgruppe prüfen.'; end if;
 perform 1 from public.clubs where id=c for update;
 select id into tid from public.teams where club_id=c and lower(btrim(public.teams.name))=lower(v_name) limit 1;
 if tid is not null then return jsonb_build_object('status','exists','team_id',tid); end if;
 insert into public.teams(club_id,name,age_group) values(c,v_name,age) returning id into tid;
 return jsonb_build_object('status','created','team_id',tid);
end $$;
create or replace function public.exchange_manager_create_team(p_club_id uuid,p_name text,p_age_group text) returns jsonb language sql security invoker set search_path='' as $$select private.exchange_manager_create_team(p_club_id,p_name,p_age_group);$$;
create table if not exists private.exchange_management_audit(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,actor_id uuid references auth.users(id) on delete set null,listing_id uuid references public.exchange_listings(id) on delete set null,action text not null,created_at timestamptz not null default now());
alter table private.exchange_management_audit enable row level security;
revoke all on private.exchange_management_audit from public,anon,authenticated;
create or replace function private.exchange_manager_listings(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.exchange_can_manage(c,'market') then raise exception 'Keine Berechtigung für den Vereinsmarkt.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'owner',l.owner_label,'status',l.status,'size',l.size,'revision',l.revision) order by l.created_at desc),'[]'::jsonb) from public.exchange_listings l where l.club_id=c and l.status<>'Entwurf');
end $$;
create or replace function public.exchange_manager_listings(p_club_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.exchange_manager_listings(p_club_id);$$;
create or replace function private.exchange_manager_hide_listing(c uuid,l uuid,expected integer) returns boolean language plpgsql security definer set search_path='' as $$begin
 if not private.exchange_can_manage(c,'market') then raise exception 'Keine Berechtigung für den Vereinsmarkt.'; end if;
 update public.exchange_listings set status='Entwurf',is_public=false,public_confirmed_at=null where id=l and club_id=c and revision=expected and status<>'Entwurf';
 if not found then raise exception 'Das Inserat wurde geändert. Bitte neu laden.' using errcode='40001'; end if;
 insert into private.exchange_management_audit(club_id,actor_id,listing_id,action) values(c,auth.uid(),l,'hide');return true;
end $$;
create or replace function public.exchange_manager_hide_listing(p_club_id uuid,p_listing_id uuid,p_expected integer) returns boolean language sql security invoker set search_path='' as $$select private.exchange_manager_hide_listing(p_club_id,p_listing_id,p_expected);$$;
do $grants$
declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('exchange_can_manage','can_manage_exchange','exchange_manager_clubs','exchange_manager_candidates','exchange_manager_assign','exchange_manager_create_team','exchange_manager_listings','exchange_manager_hide_listing') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $grants$;
