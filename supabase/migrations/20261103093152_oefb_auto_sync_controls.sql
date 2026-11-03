alter table public.team_seasons add column oefb_auto_sync_enabled boolean not null default false;

create or replace function oefb_sync.tick() returns void language plpgsql security definer set search_path='' as $$
declare task record; response record; sid uuid; body jsonb; games jsonb; round_row jsonb;
 base_url text; changed integer; new_request bigint;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('oefb-background-sync',0)) then return; end if;
 select origin into base_url from oefb_sync.config where singleton;
 if base_url is null then return; end if;
 insert into oefb_sync.tasks(competition_id,round_id)
 select distinct ts.oefb_table_competition_id,0
 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
 where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id ~ '^[0-9]{1,10}$'
 on conflict do nothing;

 for task in select * from oefb_sync.tasks where request_id is not null order by requested_at limit 20 for update loop
  select * into response from net._http_response where id=task.request_id;
  if not found then
   if task.requested_at < now()-interval '2 minutes' then
    update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error='HTTP response missing or timed out' where competition_id=task.competition_id and round_id=task.round_id;
   end if;
   continue;
  end if;
  begin
   if response.status_code is distinct from 200 or coalesce(response.timed_out,false) or response.error_msg is not null then raise exception 'Upstream HTTP %',response.status_code; end if;
   body:=response.content::jsonb;
   if jsonb_typeof(body->'games') is distinct from 'array' or jsonb_array_length(body->'games')>500 or (body->>'round')::integer is distinct from task.round_id then raise exception 'Invalid source response'; end if;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',substring(g->>'sourceUrl' from '^https://(?:www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/([0-9]{1,10})/'),
    'kickoff',g->>'kickoff','score',g->>'score','status',g->>'status')), '[]'::jsonb) into games
   from jsonb_array_elements(body->'games') g
   where g->>'sourceUrl' ~ '^https://(www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/[0-9]{1,10}/';
   changed:=0;
   for sid in select ts.id from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
    where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id=task.competition_id loop
    changed:=changed+oefb_sync.reconcile(sid,task.competition_id,games);
   end loop;
   if task.round_id=0 then
    if jsonb_typeof(body->'rounds') is distinct from 'array' or jsonb_array_length(body->'rounds')>101 then raise exception 'Invalid rounds'; end if;
    for round_row in select value from jsonb_array_elements(body->'rounds') loop
     if round_row->>'id' ~ '^[0-9]{1,3}$' and (round_row->>'id')::integer between 1 and 100 then
      insert into oefb_sync.tasks(competition_id,round_id) values(task.competition_id,(round_row->>'id')::integer) on conflict do nothing;
     end if;
    end loop;
   end if;
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '15 minutes',last_success=now(),last_error=null,updated_count=changed where competition_id=task.competition_id and round_id=task.round_id;
  exception when others then
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error=left(sqlerrm,300) where competition_id=task.competition_id and round_id=task.round_id;
  end;
 end loop;

 for task in select q.* from oefb_sync.tasks q where q.request_id is null and q.next_at<=now()
 and exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id=q.competition_id)
 order by q.next_at,q.competition_id,q.round_id limit 4 for update loop
  new_request:=net.http_get(url:=base_url||'/api/oefb/table',params:=jsonb_build_object('view','results','id',task.competition_id,'round',task.round_id),timeout_milliseconds:=20000);
  update oefb_sync.tasks set request_id=new_request,requested_at=now() where competition_id=task.competition_id and round_id=task.round_id;
 end loop;
end $$;
revoke all on function oefb_sync.tick() from public,anon,authenticated,service_role;


create function public.get_oefb_auto_sync_status(p_team_season_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ts public.team_seasons%rowtype; result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 select * into strict ts from public.team_seasons where id=p_team_season_id;
 select jsonb_build_object('enabled',ts.oefb_auto_sync_enabled,'competition_id',ts.oefb_table_competition_id,'team_name',ts.oefb_table_team_name,
 'scheduled',exists(select 1 from cron.job where jobname='oefb-fixture-sync' and active) and exists(select 1 from oefb_sync.config),
 'last_success',max(last_success),'last_error',max(last_error),'pending',count(*) filter(where request_id is not null)) into result
 from oefb_sync.tasks where competition_id=ts.oefb_table_competition_id;
 return result;
end $$;
revoke all on function public.get_oefb_auto_sync_status(uuid) from public,anon;
grant execute on function public.get_oefb_auto_sync_status(uuid) to authenticated;

create function public.set_oefb_auto_sync(p_team_season_id uuid,p_enabled boolean,p_expected_competition_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ts public.team_seasons%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 select s.* into ts from public.team_seasons s join public.teams t on t.id=s.team_id join public.clubs c on c.id=t.club_id where s.id=p_team_season_id and s.status='active' and c.status='active' for update of s;
 if not found then raise exception 'Season is not writable' using errcode='42501'; end if;
 if p_enabled is null or ts.oefb_table_competition_id is distinct from p_expected_competition_id then raise exception 'Bewerbszuordnung hat sich geändert. Bitte neu laden.'; end if;
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
