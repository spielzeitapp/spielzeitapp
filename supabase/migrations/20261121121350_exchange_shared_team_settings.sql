-- One authoritative team selection per explicitly configured market group.
-- Configuration is environment-local; never copy TEST IDs or club content to LIVE.
create table private.exchange_team_settings_sources (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 source_club_id uuid not null references public.clubs(id) on delete cascade
);
alter table private.exchange_team_settings_sources enable row level security;
revoke all on private.exchange_team_settings_sources from public,anon,authenticated;
create function private.exchange_team_settings_source(c uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select coalesce((select source_club_id from private.exchange_team_settings_sources where club_id=c),c);
$$;
revoke all on function private.exchange_team_settings_source(uuid) from public,anon,authenticated;

-- Change only the settings storage lookup, preserving all existing authorization,
-- candidate validation, manual editing rights and optimistic concurrency checks.
do $patch$
declare d text;
begin
 select pg_get_functiondef('private.exchange_parent_teams_admin(uuid,jsonb,integer)'::regprocedure) into d;
 if position('perform 1 from public.clubs where id=c for update' in d)=0 then raise exception 'Unexpected team settings implementation';end if;
 d:=replace(d,'perform 1 from public.clubs where id=c for update','perform 1 from public.clubs where id=private.exchange_team_settings_source(c) for update');
 d:=replace(d,'private.exchange_join_settings(club_id) values(c)','private.exchange_join_settings(club_id) values(private.exchange_team_settings_source(c))');
 d:=replace(d,'from private.exchange_join_settings where club_id=c','from private.exchange_join_settings where club_id=private.exchange_team_settings_source(c)');
 d:=replace(d,'where club_id=c returning parent_team_version','where club_id=private.exchange_team_settings_source(c) returning parent_team_version');
 execute d;
 select pg_get_functiondef('private.exchange_parent_team_allowed(uuid,uuid)'::regprocedure) into d;
 d:=replace(d,'club_id=c','club_id=private.exchange_team_settings_source(c)');execute d;
 select pg_get_functiondef('private.exchange_full_team_label(uuid,uuid)'::regprocedure) into d;
 d:=replace(d,'s.club_id=c','s.club_id=private.exchange_team_settings_source(c)');execute d;
end $patch$;

-- Keep candidate pools aligned for future teams/partner links, retaining team IDs
-- and legal club ownership. Does not grant staff access or copy financial rows.
create function private.exchange_shared_team_pool() returns trigger
language plpgsql security definer set search_path='' as $$
declare root uuid; target uuid; team uuid;
begin
 if TG_TABLE_NAME='teams' then team:=new.id;else team:=new.team_id;end if;
 root:=private.exchange_team_settings_source(new.club_id);
 if not exists(select 1 from private.exchange_team_settings_sources where source_club_id=root) then return new;end if;
 for target in select club_id from private.exchange_team_settings_sources where source_club_id=root loop
  insert into public.exchange_partner_teams(club_id,team_id)
  values(target,team)
  on conflict(club_id,team_id) do nothing;
 end loop;
 return new;
end;$$;
revoke all on function private.exchange_shared_team_pool() from public,anon,authenticated;
create trigger exchange_shared_team_pool after insert on public.teams for each row execute function private.exchange_shared_team_pool();
create trigger exchange_shared_partner_pool after insert on public.exchange_partner_teams for each row execute function private.exchange_shared_team_pool();
