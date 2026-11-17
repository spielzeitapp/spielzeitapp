begin;
do $$
declare trainer uuid; sid uuid; club uuid; outsider uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid();
 token text; reg jsonb; roster jsonb; payload jsonb; other_sid uuid; n integer; guest_id uuid:=gen_random_uuid(); v2 jsonb;
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

 insert into auth.users(id,email) values(guest_id,'tournament-guest-'||guest_id::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 execute 'set local role authenticated';
 token:=public.tournament_registration_v2('invite',jsonb_build_object('participantId',pid))->>'token';
 perform set_config('request.jwt.claim.sub',guest_id::text,true);
 reg:=public.tournament_registration_v2('open',jsonb_build_object('token',token));
 if jsonb_array_length(reg->'teams')<>0 then raise exception 'New guest has unexpected memberships';end if;
 payload:=jsonb_build_object('token',token,'registrationMode','guest','revision',0,'clubName','Synthetic FC','guestTeamName','Synthetic U12','contactName','Synthetic coach','jerseyColors','Red / Black','authorized',true,'submit',true,
 'players',jsonb_build_array(jsonb_build_object('id','guest:'||gen_random_uuid()::text,'firstName','Synthetic','lastName','Player','birthYear',2015,'number',7)));
 perform public.tournament_registration_v2('save',payload);
 reg:=public.tournament_registration_v2('open',jsonb_build_object('token',token));
 if reg->>'status'<>'submitted' or reg->>'registrationMode'<>'guest' or reg->'guestDetails'->>'clubName'<>'Synthetic FC' then raise exception 'Guest submission failed';end if;
 begin perform public.tournament_registration_v2('save',payload);raise exception 'Stale guest save permitted';exception when serialization_failure then null;end;
 begin perform public.tournament_registration_v2('list',jsonb_build_object('eventId',eid));raise exception 'Guest has organizer access';exception when insufficient_privilege then null;end;
 begin perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array((payload->'players'->0)||jsonb_build_object('birthYear',null))));raise exception 'Missing year permitted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array((payload->'players'->0)||jsonb_build_object('number',100))));raise exception 'Invalid number permitted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array(payload->'players'->0,payload->'players'->0)));raise exception 'Duplicate guest permitted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array((payload->'players'->0)||jsonb_build_object('id',gen_random_uuid()))));raise exception 'Source player ID permitted';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.tournament_registration_v2('open',jsonb_build_object('token',token));raise exception 'Guest claimant leaked';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 v2:=public.tournament_registration_v2('list',jsonb_build_object('eventId',eid));
 if v2->0->'guestDetails'->>'teamName'<>'Synthetic U12' then raise exception 'Organizer missing guest context';end if;
 perform public.tournament_registration_v2('confirm',jsonb_build_object('id',reg->>'id','revision',1));
 perform set_config('request.jwt.claim.sub',guest_id::text,true);
 perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',2,'submit',false,'players','[]'::jsonb));
 reg:=public.tournament_registration_v2('open',jsonb_build_object('token',token));
 if reg->>'status'<>'draft' or jsonb_array_length(reg->'players')<>0 then raise exception 'Draft edit did not clear confirmation';end if;
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 perform public.tournament_registration_v2('revoke',jsonb_build_object('id',reg->>'id'));
 perform set_config('request.jwt.claim.sub',guest_id::text,true);
 begin perform public.tournament_registration_v2('save',payload||jsonb_build_object('revision',4));raise exception 'Revoked guest save permitted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if exists(select 1 from public.memberships where user_id=guest_id) then raise exception 'Guest was granted global membership';end if;
 if exists(select 1 from public.players where first_name='Synthetic' and last_name='Player') then raise exception 'Guest created a source player';end if;
 execute 'set local role anon';
 begin perform public.tournament_registration_v2('open',jsonb_build_object('token',token));raise exception 'Anonymous allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end;
$$;
rollback;
