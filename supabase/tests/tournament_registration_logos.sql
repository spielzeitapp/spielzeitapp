begin;
do $$
declare trainer uuid; sid uuid; club uuid; outsider uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid();
 token text; reg jsonb; roster jsonb; payload jsonb; other_sid uuid; n integer; png text:='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYd8AAAAASUVORK5CYII=';
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

 update public.clubs set logo_url='https://example.invalid/club.png' where id=club;
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 execute 'set local role authenticated';
 token:=public.tournament_registration_v3('invite',jsonb_build_object('participantId',pid))->>'token';
 reg:=public.tournament_registration_v3('open',jsonb_build_object('token',token));
 if not exists(select 1 from jsonb_array_elements(reg->'teams') x where x->>'id'=sid::text and x->>'logoUrl'='https://example.invalid/club.png') then raise exception 'Authorized club logo missing';end if;
 roster:=public.tournament_registration_v3('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid));
 payload:=jsonb_build_object('token',token,'sourceTeamSeasonId',sid,'revision',0,'players',jsonb_build_array(jsonb_build_object('id',roster->0->>'id','number',7)),
 'contactName','Synthetic trainer','jerseyColors','Red / Black','submit',true,'authorized',true,'logoChoice','app');
 perform public.tournament_registration_v3('save',payload);
 reg:=public.tournament_registration_v3('open',jsonb_build_object('token',token));
 if reg->>'logo'<>'https://example.invalid/club.png' then raise exception 'App logo not reused';end if;
 -- PNG upload and round-trip; no public asset creation.
 perform public.tournament_registration_v3('save',payload||jsonb_build_object('revision',1,'logoChoice',png));
 reg:=public.tournament_registration_v3('open',jsonb_build_object('token',token));
 if reg->>'logo'<>png then raise exception 'Uploaded logo not saved';end if;
 -- Invalid logo rolls back the entire roster save, including revision/status.
 begin perform public.tournament_registration_v3('save',payload||jsonb_build_object('revision',2,'logoChoice','data:image/svg+xml,<svg onload="alert(1)"/>'));raise exception 'Active image accepted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v3('save',payload||jsonb_build_object('revision',2,'logoChoice','https://untrusted.invalid/logo.png'));raise exception 'Arbitrary URL accepted';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v3('save',payload||jsonb_build_object('revision',2,'logoChoice','data:image/png;base64,iVBORw0KGgo'||repeat('A',180000)));raise exception 'Large logo accepted';exception when invalid_parameter_value then null;end;
 reg:=public.tournament_registration_v3('open',jsonb_build_object('token',token));
 if (reg->>'revision')::integer<>2 or reg->>'logo'<>png then raise exception 'Failed save was not atomic';end if;
 perform public.tournament_registration_v3('confirm',jsonb_build_object('id',reg->>'id','revision',2));
 perform public.tournament_registration_v3('set_logo',jsonb_build_object('id',reg->>'id','revision',3,'logo',''));
 reg:=public.tournament_registration_v3('open',jsonb_build_object('token',token));
 if reg->>'logo'<>'' or reg->>'status'<>'submitted' then raise exception 'Logo removal/confirmation reset failed';end if;
 begin perform public.tournament_registration_v3('set_logo',jsonb_build_object('id',reg->>'id','revision',3,'logo',png));raise exception 'Stale admin edit accepted';exception when serialization_failure then null;end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.tournament_registration_v3('set_logo',jsonb_build_object('id',reg->>'id','revision',4,'logo',png));raise exception 'Foreign logo write permitted';exception when insufficient_privilege then null;end;
 begin perform public.tournament_registration_v3('list',jsonb_build_object('eventId',eid));raise exception 'Foreign logo read permitted';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 begin perform public.tournament_registration_v3('open',jsonb_build_object('token',token));raise exception 'Anonymous logo access permitted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select logo_url from public.clubs where id=club)<>'https://example.invalid/club.png' then raise exception 'Source club logo changed';end if;
end;
$$;
rollback;
