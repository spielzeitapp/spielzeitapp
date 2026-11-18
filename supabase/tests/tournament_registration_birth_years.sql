begin;
do $$
declare trainer uuid; sid uuid; club uuid; outsider uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid();
 token text; reg jsonb; roster jsonb; payload jsonb; other_sid uuid; n integer; player uuid; old_year date;
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

 select player_id into player from public.team_season_players where team_season_id=sid and status='active' limit 1;
 select "Geburtsdatum" into old_year from public.players where id=player;
 update public.players set "Geburtsdatum"=null where id=player;
 update public.player_profiles set birthdate=null where player_id=player;
 perform set_config('request.jwt.claim.sub',trainer::text,true);
 execute 'set local role authenticated';
 token:=public.tournament_registration_v4('invite',jsonb_build_object('participantId',pid))->>'token';
 payload:=jsonb_build_object('token',token,'sourceTeamSeasonId',sid,'revision',0,'players',jsonb_build_array(jsonb_build_object('id',player,'number',7)),
 'contactName','Synthetic coach','jerseyColors','Red / Black','submit',true,'authorized',true);
 begin perform public.tournament_registration_v4('save',payload);raise exception 'Missing year allowed';exception when invalid_parameter_value then null;end;
 begin perform public.tournament_registration_v4('save',payload||jsonb_build_object('players',jsonb_build_array(jsonb_build_object('id',player,'number',7,'birthYear',2999))));raise exception 'Future year allowed';exception when invalid_parameter_value then null;end;
 perform public.tournament_registration_v4('save',payload||jsonb_build_object('players',jsonb_build_array(jsonb_build_object('id',player,'number',7,'birthYear',2015))));
 reg:=public.tournament_registration_v4('open',jsonb_build_object('token',token));
 if reg->'players'->0->>'birthYear'<>'2015' or reg->'players'->0->>'birthYearSource'<>'registration' then raise exception 'Manual year not persisted';end if;
 roster:=public.tournament_registration_v4('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid));
 if not exists(select 1 from jsonb_array_elements(roster)x where x->>'id'=player::text and x->>'birthYear'='2015') then raise exception 'Reload lost manual year';end if;
 begin perform public.tournament_registration_v4('save',payload);raise exception 'Stale year edit allowed';exception when serialization_failure then null;end;
 execute 'reset role';
 if (select birthdate from public.player_profiles where player_id=player) is not null then raise exception 'Canonical profile was modified';end if;
 if (select "Geburtsdatum" from public.players where id=player) is not null then raise exception 'Source profile was modified';end if;
 insert into public.player_profiles(player_id,birthdate) values(player,'2014-01-02') on conflict(player_id) do update set birthdate=excluded.birthdate;
 execute 'set local role authenticated';
 begin perform public.tournament_registration_v4('save',payload||jsonb_build_object('revision',1,'players',jsonb_build_array(jsonb_build_object('id',player,'number',7,'birthYear',2015))));raise exception 'Source year overwritten';exception when invalid_parameter_value then null;end;
 roster:=public.tournament_registration_v4('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid));
 if not exists(select 1 from jsonb_array_elements(roster)x where x->>'id'=player::text and x->>'birthYear'='2014' and x->>'birthYearSource'='app') then raise exception 'Source year did not take precedence';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.tournament_registration_v4('roster',jsonb_build_object('token',token,'sourceTeamSeasonId',sid));raise exception 'Outsider read allowed';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 begin perform public.tournament_registration_v4('open',jsonb_build_object('token',token));raise exception 'Anon allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end;
$$;
rollback;
