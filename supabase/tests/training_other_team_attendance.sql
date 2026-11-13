-- Execute inside a transaction after the migration; no fixtures survive rollback.
create temporary table hall_fixture(staff uuid, outsider uuid, parent_user uuid, season uuid, event uuid, normal_event uuid, state jsonb);
grant select on hall_fixture to authenticated;
do $$
declare staff uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); parent_user uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); normal uuid:=gen_random_uuid(); s jsonb:= '{"version":1,"teams":[{"name":"Rot","playerIds":[]},{"name":"Blau","playerIds":[]},{"name":"Gelb","playerIds":[]}],"format":3,"total":3600,"pause":120,"target":480,"cycles":2,"seconds":500,"buffer":0,"games":[{"home":0,"away":1,"status":"pending","elapsed":0,"runningSince":null,"goals":[]},{"home":0,"away":2,"status":"pending","elapsed":0,"runningSince":null,"goals":[]},{"home":1,"away":2,"status":"pending","elapsed":0,"runningSince":null,"goals":[]},{"home":0,"away":1,"status":"pending","elapsed":0,"runningSince":null,"goals":[]},{"home":0,"away":2,"status":"pending","elapsed":0,"runningSince":null,"goals":[]},{"home":1,"away":2,"status":"pending","elapsed":0,"runningSince":null,"goals":[]}]}'::jsonb; ids uuid[]:=array[]::uuid[]; pid uuid; i integer;
begin
 insert into auth.users(id,email) values(staff,staff::text||'@hall-test.invalid'),(outsider,outsider::text||'@hall-test.invalid'),(parent_user,parent_user::text||'@hall-test.invalid');
 insert into public.team_seasons(id,status) values(sid,'active');
 insert into public.memberships(user_id,team_season_id,role) values(staff,sid,'trainer'),(parent_user,sid,'parent');
 insert into public.events(id,team_season_id,kind,type,notes,starts_at) values(eid,sid,'training','training','Hallentraining',now()),(normal,sid,'training','training','Training',now());
 for i in 0..8 loop pid:=gen_random_uuid();ids:=array_append(ids,pid);insert into public.players(id,team_season_id) values(pid,sid);end loop;
 for i in 0..2 loop s:=jsonb_set(s,array['teams',i::text,'playerIds'],to_jsonb(ids[i*3+1:i*3+3]));end loop;
 insert into hall_fixture values(staff,outsider,parent_user,sid,eid,normal,s);
end $$;

-- All fixtures are synthetic and rolled back.
insert into public.player_guardians(user_id,player_id) select parent_user,(state#>>'{teams,0,playerIds,0}')::uuid from hall_fixture;
insert into public.team_season_players(team_season_id,player_id) select f.season,p.id from hall_fixture f join public.players p on p.team_season_id=f.season;
update public.events set status='canceled' where id=(select normal_event from hall_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select staff::text from hall_fixture),true);
do $$
declare f record; pid uuid; v text; q integer;
begin
 select * into f from hall_fixture;pid:=(f.state#>>'{teams,0,playerIds,0}')::uuid;
 insert into public.event_attendance(event_id,player_id,status,note) values(f.event,pid,'other_team_training','U13 · Fahrgemeinschaft');
 select status into v from public.event_attendance where event_id=f.event and player_id=pid;
 if v<>'other_team_training' then raise exception 'status missing';end if;
 q:=public.get_team_training_participation_pct(f.season);if q<>89 then raise exception 'expected 8/9 present, got %',q;end if;
 update public.event_attendance set note='U14' where event_id=f.event and player_id=pid;
 begin update public.event_attendance set note='' where event_id=f.event and player_id=pid;raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 update public.event_attendance set status='yes',note=null where event_id=f.event and player_id=pid;
 update public.event_attendance set status='other_team_training',note='U13' where event_id=f.event and player_id=pid;
end $$;
select set_config('request.jwt.claim.sub',(select parent_user::text from hall_fixture),true);
do $$declare f record;begin select * into f from hall_fixture;
 update public.event_attendance set note='U13 · Fahrgemeinschaft Eltern' where event_id=f.event and player_id=(f.state#>>'{teams,0,playerIds,0}')::uuid;
 if not exists(select 1 from public.event_attendance where event_id=f.event and note='U13 · Fahrgemeinschaft Eltern') then raise exception 'parent update failed';end if;
end $$;
select set_config('request.jwt.claim.sub',(select outsider::text from hall_fixture),true);
do $$declare f record;begin select * into f from hall_fixture;
 if exists(select 1 from public.event_attendance where event_id=f.event) then raise exception 'outsider leaked';end if;
 begin insert into public.event_attendance(event_id,player_id,status,note) values(f.event,(f.state#>>'{teams,1,playerIds,0}')::uuid,'other_team_training','U13');raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
end $$;
reset role;
select 'PASS other-team training: authenticated trainer create/read/update/reset, required team name, own-team quote 8/9, outsider read/write denied' as result;
