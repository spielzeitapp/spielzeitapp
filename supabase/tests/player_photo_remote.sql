begin;
do $$
declare tester uuid; outsider uuid; sid uuid; session_id uuid; camera uuid:=gen_random_uuid(); n int;
begin
 select ts.id into sid from public.team_seasons ts where ts.status='active' limit 1;
 select p.id into tester from public.profiles p where not coalesce(p.is_admin,false)
 and not exists(select 1 from public.user_roles r where r.user_id=p.id and lower(trim(r.role))='admin')
 and not exists(select 1 from public.memberships m where m.user_id=p.id and m.team_season_id=sid) limit 1;
 assert sid is not null and tester is not null;
 insert into public.memberships(user_id,team_season_id,role) values(tester,sid,'trainer');
 perform set_config('request.jwt.claim.sub',tester::text,true);execute 'set local role authenticated';
 insert into public.player_photo_remote_sessions(team_season_id) values(sid) returning id into session_id;
 assert (select owner_id=tester from public.player_photo_remote_sessions where id=session_id);
 begin insert into public.player_photo_remote_sessions(team_season_id,created_at,expires_at) values(sid,now()+interval '7 days',now()+interval '8 days');raise exception 'Client lifetime override allowed';exception when insufficient_privilege then null;end;
 update public.player_photo_remote_sessions set camera_id=camera,camera_seen_at=now(),state='{"ready":true}' where id=session_id and camera_id is null;
 get diagnostics n=row_count;assert n=1;
 update public.player_photo_remote_sessions set camera_id=gen_random_uuid() where id=session_id and camera_id is null;
 get diagnostics n=row_count;assert n=0,'Concurrent camera claim accepted';
 update public.player_photo_remote_sessions set command=jsonb_build_object('id',gen_random_uuid(),'action','capture') where id=session_id;
 update public.player_photo_remote_sessions set ack=gen_random_uuid() where id=session_id and command->>'id'=gen_random_uuid()::text;
 get diagnostics n=row_count;assert n=0,'Stale command acknowledged';
 update public.player_photo_remote_sessions set ack=(command->>'id')::uuid where id=session_id;
 begin update public.player_photo_remote_sessions set owner_id=gen_random_uuid() where id=session_id;raise exception 'Owner change allowed';exception when insufficient_privilege then null;end;
 begin update public.player_photo_remote_sessions set expires_at=now()+interval '7 days' where id=session_id;raise exception 'Expiry extension allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);execute 'set local role authenticated';
 assert (select count(*)=0 from public.player_photo_remote_sessions where id=session_id),'Other account can read preview';
 update public.player_photo_remote_sessions set state='{}' where id=session_id;get diagnostics n=row_count;assert n=0;
 begin insert into public.player_photo_remote_sessions(team_season_id) values(sid);raise exception 'Unprivileged session creation allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 -- Simulate expiry without waiting. No application role can alter these columns.
 update public.player_photo_remote_sessions set created_at=now()-interval '3 hours',expires_at=now()-interval '1 hour' where id=session_id;
 perform set_config('request.jwt.claim.sub',tester::text,true);execute 'set local role authenticated';
 assert (select count(*)=0 from public.player_photo_remote_sessions where id=session_id),'Expired session still readable';
 update public.player_photo_remote_sessions set state='{}' where id=session_id;get diagnostics n=row_count;assert n=0;
 execute 'reset role';
 assert not has_table_privilege('anon','public.player_photo_remote_sessions','SELECT');
 assert exists(select 1 from cron.job where jobname='player-photo-remote-expiry' and active);
end $$;
rollback;
