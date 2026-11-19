-- Provenance is private and can only be written by the market creation RPC.
create table if not exists private.exchange_manual_teams (
 team_id uuid primary key references public.teams(id) on delete cascade,
 club_id uuid not null references public.clubs(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now()
);
alter table private.exchange_manual_teams enable row level security;
revoke all on private.exchange_manual_teams from public,anon,authenticated;
create index if not exists exchange_manual_teams_club_idx on private.exchange_manual_teams(club_id);
create or replace function private.exchange_manager_create_team(c uuid,n text,a text) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;v_name text:=nullif(btrim(n),'');age text:=nullif(btrim(a),'');
begin
 if not private.exchange_can_manage(c,'teams') then raise exception 'Keine Berechtigung für Teams.'; end if;
 if v_name is null or char_length(v_name)>80 or v_name ~ '[[:cntrl:]]' or age is null or age!~'^U[0-9]{1,2}$' then raise exception 'Bitte Teamname und Altersgruppe prüfen.'; end if;
 perform 1 from public.clubs where id=c for update;
 select id into tid from public.teams where club_id=c and lower(btrim(public.teams.name))=lower(v_name) limit 1;
 -- An existing centrally created team never acquires market provenance through this call.
 if tid is not null then return jsonb_build_object('status','exists','team_id',tid); end if;
 insert into public.teams(club_id,name,age_group) values(c,v_name,age) returning id into tid;
 insert into private.exchange_manual_teams(team_id,club_id,created_by) values(tid,c,auth.uid());
 return jsonb_build_object('status','created','team_id',tid);
end $$;
-- Extend the existing settings response without changing its validation or partner-team rules.
do $patch$
declare def text;needle text:='''enabled'',private.exchange_parent_team_allowed(c,x.id)';addition text;
begin
 select pg_get_functiondef('private.exchange_parent_teams_admin(uuid,jsonb,integer)'::regprocedure) into def;
 if position('''can_edit''' in def)=0 then
  if position(needle in def)=0 then raise exception 'Unexpected parent-team function definition';end if;
  addition:='''can_edit'',exists(select 1 from private.exchange_manual_teams mt where mt.team_id=x.id and mt.club_id=c and x.club_id=c) and not exists(select 1 from public.team_seasons ts where ts.team_id=x.id),''edit_version'',(select mt.version from private.exchange_manual_teams mt where mt.team_id=x.id and mt.club_id=c),';
  execute replace(def,needle,addition||needle);
 end if;
end $patch$;
create or replace function private.exchange_manager_update_team(c uuid,t uuid,n text,a text,expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text:=nullif(btrim(n),'');age text:=nullif(btrim(a),'');current_version integer;
begin
 if not private.exchange_can_manage(c,'teams') then raise exception 'Keine Berechtigung für Teams.';end if;
 if v_name is null or char_length(v_name)>80 or v_name ~ '[[:cntrl:]]' or age is null or age!~'^U[0-9]{1,2}$' then raise exception 'Bitte Teamname und Altersgruppe prüfen.';end if;
 perform 1 from public.clubs where id=c for update;
 select mt.version into current_version from private.exchange_manual_teams mt join public.teams x on x.id=mt.team_id where mt.team_id=t and mt.club_id=c and x.club_id=c for update of mt,x;
 if current_version is null then raise exception 'Dieses Team wird zentral unter Mannschaften bearbeitet.';end if;
 if exists(select 1 from public.team_seasons ts where ts.team_id=t) then raise exception 'Dieses Team ist mit einer Saison verknüpft. Bitte zentral unter Mannschaften bearbeiten.';end if;
 if expected is null or expected<>current_version then raise exception 'Das Team wurde inzwischen geändert. Bitte neu laden.' using errcode='40001';end if;
 if exists(select 1 from public.teams x where x.club_id=c and x.id<>t and lower(btrim(x.name))=lower(v_name)) then raise exception 'Ein Team mit diesem Namen ist bereits vorhanden.';end if;
 -- Update in place: all parent memberships and approved-team IDs remain unchanged.
 update public.teams set name=v_name,age_group=age where id=t;
 update private.exchange_manual_teams set version=version+1 where team_id=t;
 update private.exchange_join_settings set parent_team_version=parent_team_version+1 where club_id=c;
 return private.exchange_parent_teams_admin(c,null,null);
end $$;
create or replace function public.exchange_manager_update_team(p_club_id uuid,p_team_id uuid,p_name text,p_age_group text,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select private.exchange_manager_update_team(p_club_id,p_team_id,p_name,p_age_group,p_expected);$$;
revoke all on function private.exchange_manager_update_team(uuid,uuid,text,text,integer) from public,anon;
revoke all on function public.exchange_manager_update_team(uuid,uuid,text,text,integer) from public,anon;
grant execute on function private.exchange_manager_update_team(uuid,uuid,text,text,integer) to authenticated;
grant execute on function public.exchange_manager_update_team(uuid,uuid,text,text,integer) to authenticated;
notify pgrst,'reload schema';
