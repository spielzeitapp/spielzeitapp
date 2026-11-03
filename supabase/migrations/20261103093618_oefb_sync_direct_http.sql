-- Read directly over HTTPS; do not trust the extension's globally writable
-- asynchronous response tables as an automatic result source.
create extension if not exists http with schema extensions;

create function oefb_sync.consume(p_competition text,p_round integer,p_status integer,p_content text)
returns void language plpgsql security definer set search_path='' as $$
declare body jsonb; games jsonb; round_row jsonb; sid uuid; changed integer;
begin
 begin
   if p_status is distinct from 200 then raise exception 'Upstream HTTP %',p_status; end if;
   body:=p_content::jsonb;
   if jsonb_typeof(body->'games') is distinct from 'array' or jsonb_array_length(body->'games')>500 or (body->>'round')::integer is distinct from p_round then raise exception 'Invalid source response'; end if;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',substring(g->>'sourceUrl' from '^https://(?:www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/([0-9]{1,10})/'),
    'kickoff',g->>'kickoff','score',g->>'score','status',g->>'status')), '[]'::jsonb) into games
   from jsonb_array_elements(body->'games') g
   where g->>'sourceUrl' ~ '^https://(www\.)?oefb\.at/bewerbe/Spiel/Spielbericht/[0-9]{1,10}/';
   changed:=0;
   for sid in select ts.id from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
    where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id=p_competition loop
    changed:=changed+oefb_sync.reconcile(sid,p_competition,games);
   end loop;
   if p_round=0 then
    if jsonb_typeof(body->'rounds') is distinct from 'array' or jsonb_array_length(body->'rounds')>101 then raise exception 'Invalid rounds'; end if;
    for round_row in select value from jsonb_array_elements(body->'rounds') loop
     if round_row->>'id' ~ '^[0-9]{1,3}$' and (round_row->>'id')::integer between 1 and 100 then
      insert into oefb_sync.tasks(competition_id,round_id) values(p_competition,(round_row->>'id')::integer) on conflict do nothing;
     end if;
    end loop;
   end if;
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '15 minutes',last_success=now(),last_error=null,updated_count=changed where competition_id=p_competition and round_id=p_round;

 exception when others then
  update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error=left(sqlerrm,300) where competition_id=p_competition and round_id=p_round;
 end;
end $$;
revoke all on function oefb_sync.consume(text,integer,integer,text) from public,anon,authenticated,service_role;

create or replace function oefb_sync.tick() returns void language plpgsql security definer set search_path='' as $$
declare task record; response record; base_url text;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('oefb-background-sync',0)) then return; end if;
 select origin into base_url from oefb_sync.config where singleton;
 if base_url is null then return; end if;
 insert into oefb_sync.tasks(competition_id,round_id)
 select distinct ts.oefb_table_competition_id,0 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
 where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id ~ '^[0-9]{1,10}$'
 on conflict do nothing;
 -- Two requests per tick, each bounded to 15 seconds. No browser credentials needed.
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','15000');
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','4000');
 for task in select q.* from oefb_sync.tasks q where q.next_at<=now()
 and exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.status='active' and c.status='active' and ts.oefb_auto_sync_enabled and ts.oefb_table_competition_id=q.competition_id)
 order by q.next_at,q.competition_id,q.round_id limit 2 for update loop
  begin
   select * into response from extensions.http_get(base_url||'/api/oefb/table?view=results&id='||task.competition_id||'&round='||task.round_id);
   perform oefb_sync.consume(task.competition_id,task.round_id,response.status,response.content);
  exception when others then
   update oefb_sync.tasks set request_id=null,requested_at=null,next_at=now()+interval '5 minutes',last_error=left(sqlerrm,300) where competition_id=task.competition_id and round_id=task.round_id;
  end;
 end loop;
end $$;
revoke all on function oefb_sync.tick() from public,anon,authenticated,service_role;

create or replace function public.get_oefb_auto_sync_status(p_team_season_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ts public.team_seasons%rowtype; result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 select * into strict ts from public.team_seasons where id=p_team_season_id;
 select jsonb_build_object('enabled',ts.oefb_auto_sync_enabled,'competition_id',ts.oefb_table_competition_id,'team_name',ts.oefb_table_team_name,
 'scheduled',exists(select 1 from cron.job where jobname='oefb-fixture-sync' and active) and exists(select 1 from oefb_sync.config),
 'last_success',max(last_success),'last_error',max(last_error),'pending',count(*) filter(where next_at<=now())) into result
 from oefb_sync.tasks where competition_id=ts.oefb_table_competition_id;
 return result;
end $$;
revoke all on function public.get_oefb_auto_sync_status(uuid) from public,anon;
grant execute on function public.get_oefb_auto_sync_status(uuid) to authenticated;

