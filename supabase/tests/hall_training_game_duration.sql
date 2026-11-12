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
set local role authenticated;
select set_config('request.jwt.claim.sub',(select staff::text from hall_fixture),true);
do $$
declare f record; v integer; bad jsonb;
begin
 select * into f from hall_fixture;
 v:=public.save_hall_training_day(f.event,f.state,0);if v<>1 then raise exception 'initial save failed';end if;
 v:=public.save_hall_training_day(f.event,f.state,1);if v<>2 then raise exception 'repeat save failed';end if;
 begin perform public.save_hall_training_day(f.event,f.state,1);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' or sqlerrm not like '%neu laden%' then raise;end if;end;
 begin perform public.save_hall_training_day(f.normal_event,f.state,0);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(f.state,'{seconds}','2000');
 begin perform public.save_hall_training_day(f.event,bad,2);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(f.state,'{teams,1,playerIds,0}',f.state#>'{teams,0,playerIds,0}');
 begin perform public.save_hall_training_day(f.event,bad,2);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(f.state,'{teams,1,playerIds,0}',to_jsonb(gen_random_uuid()::text));
 begin perform public.save_hall_training_day(f.event,bad,2);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(f.state,'{games,0,home}','2');
 begin perform public.save_hall_training_day(f.event,bad,2);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(jsonb_set(f.state,'{games,0,status}','"running"'),'{games,0,runningSince}',to_jsonb(extract(epoch from clock_timestamp())*1000));
 v:=public.save_hall_training_day(f.event,bad,2);if v<>3 then raise exception 'start failed';end if;
 bad:=jsonb_set(jsonb_set(bad,'{games,1,status}','"running"'),'{games,1,runningSince}',to_jsonb(extract(epoch from clock_timestamp())*1000));
 begin perform public.save_hall_training_day(f.event,bad,3);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(jsonb_set(jsonb_set(f.state,'{games,0,status}','"finished"'),'{games,0,elapsed}','500'),'{games,0,goals}','[{"team":0,"second":10}]');
 v:=public.save_hall_training_day(f.event,bad,3);if v<>4 then raise exception 'finish failed';end if;
 if (select count(*) from public.hall_training_days where event_id=f.event)<>1 then raise exception 'staff read failed';end if;
end $$;

-- Individual timing under the real authenticated staff role, not bypassrls.
do $$
declare f record; s jsonb; bad jsonb; v integer;
begin
 select * into f from hall_fixture;
 select state into s from public.hall_training_days where event_id=f.event;
 s:=jsonb_set(s,'{games,1,seconds}','600');
 v:=public.save_hall_training_day(f.event,s,4); if v<>5 then raise exception 'longer upcoming game failed'; end if;
 bad:=jsonb_set(s,'{games,0,seconds}','600');
 begin perform public.save_hall_training_day(f.event,bad,5);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' or sqlerrm not like '%vor Spielbeginn%' then raise;end if;end;
 s:=jsonb_set(jsonb_set(s,'{games,1,seconds}','300'),'{buffer}','200');
 v:=public.save_hall_training_day(f.event,s,5); if v<>6 then raise exception 'shorter upcoming game failed'; end if;
 begin perform public.save_hall_training_day(f.event,s,5);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' or sqlerrm not like '%neu laden%' then raise;end if;end;
 bad:=jsonb_set(s,'{games,1,seconds}','0');
 begin perform public.save_hall_training_day(f.event,bad,6);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 bad:=jsonb_set(s,'{games,1,seconds}','60.5');
 begin perform public.save_hall_training_day(f.event,bad,6);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
 s:=jsonb_set(jsonb_set(s,'{games,1,status}','"running"'),'{games,1,runningSince}',to_jsonb(extract(epoch from clock_timestamp())*1000));
 v:=public.save_hall_training_day(f.event,s,6);if v<>7 then raise exception 'custom clock start failed';end if;
 bad:=jsonb_set(jsonb_set(s,'{games,1,seconds}','400'),'{buffer}','100');
 begin perform public.save_hall_training_day(f.event,bad,7);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' or sqlerrm not like '%vor Spielbeginn%' then raise;end if;end;
 bad:=jsonb_set(s,'{games,1,goals}','[{"team":0,"second":301}]');
 begin perform public.save_hall_training_day(f.event,bad,7);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' or sqlerrm not like '%Ungültiges Tor%' then raise;end if;end;
 s:=jsonb_set(s,'{games,1,goals}',jsonb_build_array(jsonb_build_object('team',0,'second',299,'scorerId',f.state#>>'{teams,0,playerIds,0}','scorerName','Synthetic scorer')));
 s:=jsonb_set(jsonb_set(jsonb_set(s,'{games,1,status}','"finished"'),'{games,1,runningSince}','null'),'{games,1,elapsed}','300');
 v:=public.save_hall_training_day(f.event,s,7);if v<>8 then raise exception 'custom game finish failed';end if;
 v:=public.save_hall_training_day(f.event,s,8);if v<>9 then raise exception 'repeat custom save failed';end if;
 if (select state#>>'{games,0,goals,0,second}' from public.hall_training_days where event_id=f.event)<>'10' then raise exception 'existing result changed';end if;
end $$;

select set_config('request.jwt.claim.sub',(select outsider::text from hall_fixture),true);
do $$ declare f record;begin select * into f from hall_fixture;if exists(select 1 from public.hall_training_days where event_id=f.event) then raise exception 'outsider leaked';end if;
 begin perform public.save_hall_training_day(f.event,f.state,9);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select parent_user::text from hall_fixture),true);
do $$ declare f record;begin select * into f from hall_fixture;if exists(select 1 from public.hall_training_days where event_id=f.event) then raise exception 'parent leaked';end if;
 begin perform public.save_hall_training_day(f.event,f.state,9);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select staff::text from hall_fixture),true);
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
do $$ declare f record;begin select * into f from hall_fixture;
 if exists(select 1 from public.hall_training_days where event_id=f.event) then raise exception 'anonymous Auth session leaked';end if;
 begin perform public.save_hall_training_day(f.event,f.state,9);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
reset role;
update public.team_seasons set status='archived' where id=(select season from hall_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select staff::text from hall_fixture),true);
do $$ declare f record;begin select * into f from hall_fixture;if (select count(*) from public.hall_training_days where event_id=f.event)<>1 then raise exception 'archive read failed';end if;
 begin perform public.save_hall_training_day(f.event,f.state,9);raise exception 'Expected rejection';exception when others then if sqlerrm='Expected rejection' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.hall_training_days;raise exception 'Expected rejection';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS hall duration: extend/shorten upcoming games, frozen running/finished lengths, custom goal time bounds, results retained, repeat/stale writes; hall training: staff create/update/read, valid clock/finish, stale revision, invalid timing/pairings/roster, normal training blocked, outsider/parent/anon denied, archive write blocked' as result;
