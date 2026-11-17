begin;
do $$
declare trainer uuid; sid uuid; club uuid; outsider uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid();
 token text; reg jsonb; roster jsonb; payload jsonb; other_sid uuid; n integer;
begin
 select m.user_id,m.team_season_id,t.club_id into trainer,sid,club from public.memberships m
 join public.team_seasons ts on ts.id=m.team_season_id join public.teams t on t.id=ts.team_id
 where m.role::text in ('trainer','head_coach','co_trainer') and ts.status='active'
 and exists(select 1 from public.team_season_players p where p.team_season_id=ts.id and p.status='active') limit 1;
 if trainer is null then raise exception 'No authenticated roster fixture available'; end if;
 insert into public.club_admin_assignments(club_id,user_id,is_active) values(club,trainer,true)
 on conflict(club_id,user_id) do update set is_active=true;
 insert into public.events(id,team_season_id,kind,type,starts_at,location) values(eid,sid,'tournament','tournament',now()+interval '7 days','Synthetic rollback fixture');
 insert into public.tournament_participants(id,tournament_event_id,team_name) values(pid,eid,'Synthetic rollback team');
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 execute 'set local role authenticated';
 token:=public.tournament_registration_api('invite',jsonb_build_object('participantId',pid))->>'token';
 reg:=public.tournament_registration_api('open',jsonb_build_object('token',token));
 if reg->>'teamName'<>'Synthetic rollback team' then raise exception 'Wrong invitation'; end if;
 roster:=public.tournament_registration_api('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid));
 payload:=jsonb_build_object('token',token,'sourceTeamSeasonId',sid,'revision',0,'players',jsonb_build_array(jsonb_build_object('id',roster->0->>'id','number',7)),
  'contactName','Synthetic trainer','jerseyColors','Red / Black','submit',true,'authorized',true);
 perform public.tournament_registration_api('save',payload);
 reg:=public.tournament_registration_api('open',jsonb_build_object('token',token));
 if reg->>'status'<>'submitted' or reg->'players'->0->>'number'<>'7' then raise exception 'Submission not persisted'; end if;
 if public.tournament_registration_api('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid))<>roster then raise exception 'Source roster changed'; end if;
 -- Optimistic concurrency, repeat write and duplicate payload must fail atomically.
 begin perform public.tournament_registration_api('save',payload);raise exception 'Stale save permitted';exception when serialization_failure then null;end;
 begin perform public.tournament_registration_api('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array(payload->'players'->0,payload->'players'->0)));raise exception 'Duplicate permitted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_api('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'number',8))));raise exception 'Foreign player permitted';exception when insufficient_privilege then null;end;
 begin perform public.tournament_registration_api('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',gen_random_uuid()));raise exception 'Foreign roster permitted';exception when insufficient_privilege then null;end;
 perform public.tournament_registration_api('confirm',jsonb_build_object('id',reg->>'id','revision',1));
 reg:=public.tournament_registration_api('open',jsonb_build_object('token',token));
 if reg->>'status'<>'confirmed' then raise exception 'Confirmation failed';end if;
 perform public.tournament_registration_api('save',payload||jsonb_build_object('revision',2,'submit',false));
 reg:=public.tournament_registration_api('open',jsonb_build_object('token',token));
 if reg->>'status'<>'draft' then raise exception 'Edit did not clear confirmation';end if;
 -- Unrelated authenticated user (valid JWT subject, no team authority) has no access.
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.tournament_registration_api('list',jsonb_build_object('eventId',eid));raise exception 'Outsider organizer access';exception when insufficient_privilege then null;end;
 begin perform public.tournament_registration_api('open',jsonb_build_object('token',token));raise exception 'Outsider claimed access';exception when insufficient_privilege then null;end;
 begin execute 'select count(*) from tournament_registration.entries';raise exception 'Direct table read permitted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 -- Reissuing invalidates the original token; revocation blocks the replacement.
 reg:=public.tournament_registration_api('invite',jsonb_build_object('participantId',pid));
 begin perform public.tournament_registration_api('open',jsonb_build_object('token',token));raise exception 'Old token permitted';exception when insufficient_privilege then null;end;
 token:=reg->>'token'; reg:=public.tournament_registration_api('open',jsonb_build_object('token',token));
 perform public.tournament_registration_api('revoke',jsonb_build_object('id',reg->>'id'));
 begin perform public.tournament_registration_api('open',jsonb_build_object('token',token));raise exception 'Revoked token permitted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.tournament_registration_api('open',jsonb_build_object('token',token));raise exception 'Unauthenticated permitted';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 begin perform public.tournament_registration_api('open',jsonb_build_object('token',token));raise exception 'Anonymous RPC permitted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 -- Source data untouched: only the dedicated registration has turnier number 7.
 if exists(select 1 from public.players where id=(roster->0->>'id')::uuid and first_name='Synthetic trainer') then raise exception 'Source data overwritten'; end if;
end;
$$;
rollback;
