create function oefb_sync.reset_on_assignment_change() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.oefb_table_competition_id is distinct from old.oefb_table_competition_id
 or new.oefb_table_team_name is distinct from old.oefb_table_team_name
 or new.age_group is distinct from old.age_group then
  new.oefb_auto_sync_enabled:=false;
 end if;
 return new;
end $$;
revoke all on function oefb_sync.reset_on_assignment_change() from public,anon,authenticated,service_role;
create trigger reset_oefb_auto_sync_on_assignment_change
 before update on public.team_seasons for each row execute function oefb_sync.reset_on_assignment_change();

create or replace function public.set_oefb_auto_sync(p_team_season_id uuid,p_enabled boolean,p_expected_competition_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ts public.team_seasons%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 select s.* into ts from public.team_seasons s join public.teams t on t.id=s.team_id join public.clubs c on c.id=t.club_id where s.id=p_team_season_id and s.status='active' and c.status='active' for update of s;
 if not found then raise exception 'Season is not writable' using errcode='42501'; end if;
 if p_enabled is null or ts.oefb_table_competition_id is distinct from p_expected_competition_id then raise exception 'Bewerbszuordnung hat sich geändert. Bitte neu laden.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('oefb-enable:'||coalesce(ts.oefb_table_competition_id,''),0));
 if p_enabled and (coalesce(ts.oefb_table_competition_id,'') !~ '^[0-9]{1,10}$' or nullif(trim(ts.oefb_table_team_name),'') is null) then raise exception 'Zuerst den richtigen ÖFB-Bewerb und Mannschaftsnamen speichern.'; end if;
 if p_enabled and exists(select 1 from public.team_seasons other where other.id<>ts.id and other.oefb_auto_sync_enabled and other.status='active' and other.oefb_table_competition_id=ts.oefb_table_competition_id and lower(trim(other.oefb_table_team_name))=lower(trim(ts.oefb_table_team_name)) and other.age_group is distinct from ts.age_group) then raise exception 'Dieser ÖFB-Eintrag wird bereits für eine andere Altersklasse abgeglichen. Bewerbszuordnung prüfen.'; end if;
 update public.team_seasons set oefb_auto_sync_enabled=p_enabled where id=ts.id;
 if p_enabled then
  insert into oefb_sync.tasks(competition_id,round_id) values(ts.oefb_table_competition_id,0) on conflict do nothing;
  update oefb_sync.tasks set next_at=now() where competition_id=ts.oefb_table_competition_id and request_id is null;
 end if;
 return public.get_oefb_auto_sync_status(ts.id);
end $$;
revoke all on function public.set_oefb_auto_sync(uuid,boolean,text) from public,anon;
grant execute on function public.set_oefb_auto_sync(uuid,boolean,text) to authenticated;
