begin;
do $$
declare aid uuid; tester uuid; sid uuid; other_sid uuid; pid uuid; rev uuid; oldrev uuid; n int; u text;
begin
 select id into aid from public.profiles where is_admin=true limit 1;
 if aid is null then select user_id into aid from public.user_roles where lower(trim(role))='admin' limit 1; end if;
 select id into sid from public.team_seasons where status='active' limit 1;
 select id into other_sid from public.team_seasons where id<>sid limit 1;
 select p.id into tester from public.profiles p where p.id<>aid and not coalesce(p.is_admin,false)
 and not exists(select 1 from public.user_roles r where r.user_id=p.id and lower(trim(r.role))='admin')
 and not exists(select 1 from public.memberships m where m.user_id=p.id and m.team_season_id=sid) limit 1;
 assert aid is not null and tester is not null and sid is not null and other_sid is not null;
 insert into public.players(team_season_id,first_name,last_name,is_active,status) values(sid,'Motif','Synthetic',true,'active') returning id into pid;
 insert into public.team_season_players(player_id,team_season_id,status,is_active) values(pid,sid,'active',true);
 u:='https://acbaecjzoabafbsjrzvr.supabase.co/storage/v1/object/public/player-avatars/'||sid||'/'||pid||'.matchday.11111111-1111-1111-1111-111111111111.jpg';
 perform set_config('request.jwt.claim.sub',tester::text,true);
 execute 'set local role authenticated';
 assert not public.can_manage_team_staff(sid);
 begin insert into public.player_photo_motifs(team_season_id,player_id,purpose,original_url) values(sid,pid,'matchday',u);raise exception 'Unauthorized insert accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 insert into public.memberships(user_id,team_season_id,role) values(tester,sid,'trainer');
 execute 'set local role authenticated';
 assert public.can_manage_team_staff(sid);
 assert public.player_avatar_storage_may_manage(sid||'/'||pid||'.matchday.11111111-1111-1111-1111-111111111111.jpg'),'Existing storage helper rejects separate motif path';
 insert into public.player_photo_motifs(team_season_id,player_id,purpose,original_url) values(sid,pid,'matchday',u) returning revision into rev;
 assert (select count(*)=1 from public.player_photo_motifs where player_id=pid);
 begin insert into public.player_photo_motifs(team_season_id,player_id,purpose,original_url) values(sid,pid,'matchday',u);raise exception 'Duplicate accepted';exception when unique_violation then null;end;
 begin insert into public.player_photo_motifs(team_season_id,player_id,purpose,original_url) values(other_sid,pid,'matchday',u);raise exception 'Wrong season accepted';exception when insufficient_privilege or check_violation then null;end;
 begin update public.player_photo_motifs set layout='{}' where player_id=pid;raise exception 'Invalid layout accepted';exception when check_violation then null;end;
 oldrev:=rev;rev:=gen_random_uuid();
 update public.player_photo_motifs set revision=rev where player_id=pid and revision=oldrev;
 update public.player_photo_motifs set revision=gen_random_uuid() where player_id=pid and revision=oldrev;
 get diagnostics n=row_count;assert n=0,'Stale update accepted';
 execute 'reset role';
 update public.team_seasons set status='archived' where id=sid;
 execute 'set local role authenticated';
 begin update public.player_photo_motifs set revision=gen_random_uuid() where player_id=pid;raise exception 'Archived season accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);execute 'set local role authenticated';
 assert (select count(*)=0 from public.player_photo_motifs where player_id=pid),'Other user can read motifs';
 update public.player_photo_motifs set revision=gen_random_uuid() where player_id=pid;get diagnostics n=row_count;assert n=0;
 execute 'reset role';
 assert (select cutout_url is null from public.players where id=pid),'Profile photo changed';
 assert not has_table_privilege('anon','public.player_photo_motifs','SELECT');
end $$;
rollback;
