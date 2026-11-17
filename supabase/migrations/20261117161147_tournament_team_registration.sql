-- TEST pilot: invitations and private roster registration for existing App teams.
-- No public roster/photo publication and no changes to source players or memberships.
create schema if not exists tournament_registration;
revoke all on schema tournament_registration from public,anon,authenticated;
create table tournament_registration.entries (
 id uuid primary key default gen_random_uuid(),
 participant_id uuid not null unique references public.tournament_participants(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null default now()+interval '30 days',
 revoked boolean not null default false,
 claimed_by uuid references auth.users(id) on delete set null,
 source_team_season_id uuid references public.team_seasons(id),
 status text not null default 'invited' check(status in ('invited','draft','submitted','confirmed')),
 revision integer not null default 0,
 contact_name text not null default '',
 contact_phone text not null default '',
 jersey_colors text not null default '',
 players jsonb not null default '[]',
 submitted_at timestamptz,
 confirmed_at timestamptz,
 confirmed_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table tournament_registration.entries enable row level security;
revoke all on all tables in schema tournament_registration from public,anon,authenticated;

-- Deliberate narrow definer gateway for the unexposed, deny-all schema.
-- All reads and writes check current database permissions; user metadata is never trusted.
create function public.tournament_registration_api(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
 uid uuid:=auth.uid();
 e tournament_registration.entries%rowtype;
 participant public.tournament_participants%rowtype;
 sid uuid; eid uuid; token text; result jsonb; roster jsonb; row_item jsonb;
 expected integer; should_submit boolean; is_staff boolean;
begin
 if uid is null then raise exception 'Bitte mit deinem SpielzeitApp-Zugang anmelden.' using errcode='42501'; end if;
 if p_action in ('list','invite','revoke','confirm') then
  if p_action='list' then
   eid:=(p_args->>'eventId')::uuid;
  elsif p_action='invite' then
   select * into participant from public.tournament_participants where id=(p_args->>'participantId')::uuid;
   eid:=participant.tournament_event_id;
  else
   select * into e from tournament_registration.entries where id=(p_args->>'id')::uuid for update;
   select * into participant from public.tournament_participants where id=e.participant_id;
   eid:=participant.tournament_event_id;
  end if;
  if eid is null or not public.tournament_screen_is_admin(eid) then
   raise exception 'Nur die zuständige Turnierleitung darf Meldungen verwalten.' using errcode='42501';
  end if;
  if p_action='list' then
   select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'teamName',p.team_name,
    'id',r.id,'status',coalesce(r.status,'not_invited'),'revision',r.revision,
    'revoked',r.revoked,'expiresAt',r.expires_at,'contactName',r.contact_name,
    'contactPhone',r.contact_phone,'jerseyColors',r.jersey_colors,'players',r.players,
    'submittedAt',r.submitted_at,'confirmedAt',r.confirmed_at) order by p.sort_order,p.team_name),'[]')
   into result from public.tournament_participants p left join tournament_registration.entries r on r.participant_id=p.id
   where p.tournament_event_id=eid;
   return result;
  elsif p_action='invite' then
   -- Rotating the invitation preserves the current roster/claimant and invalidates the old link.
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   insert into tournament_registration.entries(participant_id,token_hash)
   values(participant.id,encode(sha256(convert_to(token,'UTF8')),'hex'))
   on conflict(participant_id) do update set token_hash=excluded.token_hash,revoked=false,
    expires_at=now()+interval '30 days',revision=tournament_registration.entries.revision+1,updated_at=now();
   return jsonb_build_object('token',token);
  elsif p_action='revoke' then
   update tournament_registration.entries set revoked=true,revision=revision+1,updated_at=now() where id=e.id;
   return jsonb_build_object('ok',true);
  else
   expected:=(p_args->>'revision')::integer;
   if expected is null or expected<>e.revision then raise exception 'Meldung wurde geändert. Bitte neu laden.' using errcode='40001'; end if;
   if e.revoked or e.status<>'submitted' then raise exception 'Nur eine eingereichte Meldung kann bestätigt werden.' using errcode='22023'; end if;
   update tournament_registration.entries set status='confirmed',confirmed_at=now(),confirmed_by=uid,
    revision=revision+1,updated_at=now() where id=e.id;
   return jsonb_build_object('ok',true);
  end if;
 end if;
 if p_action not in ('open','roster','save') then raise exception 'Unbekannte Aktion' using errcode='22023'; end if;
 token:=p_args->>'token';
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Einladung ungültig.' using errcode='22023'; end if;
 select * into e from tournament_registration.entries
 where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if e.id is null or e.revoked or e.expires_at<=now() then
  raise exception 'Einladung ungültig, abgelaufen oder zurückgezogen.' using errcode='42501';
 end if;
 if e.claimed_by is not null and e.claimed_by<>uid then
  raise exception 'Diese Einladung ist bereits einem anderen Trainer zugeordnet.' using errcode='42501';
 end if;
 select * into participant from public.tournament_participants where id=e.participant_id;
 -- Recheck staff status even for a previously claimed registration.
 if e.source_team_season_id is not null then
  select exists(select 1 from public.memberships m where m.user_id=uid and m.team_season_id=e.source_team_season_id
   and m.role::text in ('trainer','head_coach','co_trainer','admin')) or public.is_platform_admin()
   or exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
    join public.club_admin_assignments ca on ca.club_id=t.club_id and ca.user_id=uid and ca.is_active
    where ts.id=e.source_team_season_id) into is_staff;
  if not is_staff then raise exception 'Deine Trainerberechtigung ist nicht mehr vorhanden.' using errcode='42501'; end if;
 end if;
 if p_action='open' then
  select coalesce(jsonb_agg(jsonb_build_object('id',ts.id,'name',coalesce(nullif(ts.display_name,''),t.name),
   'ageGroup',coalesce(ts.age_group,t.age_group),'season',s.name) order by t.name,s.name),'[]') into result
  from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.seasons s on s.id=ts.season_id
  where ts.archived_at is null and coalesce(ts.status,'active')='active' and (
   public.is_platform_admin() or exists(select 1 from public.memberships m where m.team_season_id=ts.id and m.user_id=uid
    and m.role::text in ('trainer','head_coach','co_trainer','admin'))
   or exists(select 1 from public.club_admin_assignments ca where ca.club_id=t.club_id and ca.user_id=uid and ca.is_active));
  return jsonb_build_object('id',e.id,'eventId',participant.tournament_event_id,'teamName',participant.team_name,
   'teams',result,'revision',e.revision,'status',e.status,'sourceTeamSeasonId',e.source_team_season_id,
   'contactName',e.contact_name,'contactPhone',e.contact_phone,'jerseyColors',e.jersey_colors,'players',e.players);
 end if;
 sid:=(p_args->>'sourceTeamSeasonId')::uuid;
 select exists(select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
  where ts.id=sid and ts.archived_at is null and coalesce(ts.status,'active')='active' and (
   public.is_platform_admin() or exists(select 1 from public.memberships m where m.team_season_id=ts.id and m.user_id=uid
    and m.role::text in ('trainer','head_coach','co_trainer','admin'))
   or exists(select 1 from public.club_admin_assignments ca where ca.club_id=t.club_id and ca.user_id=uid and ca.is_active))) into is_staff;
 if sid is null or not is_staff then raise exception 'Für diese Mannschaft fehlt die Trainerberechtigung.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'firstName',p.first_name,'lastName',p.last_name,
  'birthYear',extract(year from p."Geburtsdatum"),'number',tsp.jersey_number) order by p.last_name,p.first_name),'[]')
 into roster from public.team_season_players tsp join public.players p on p.id=tsp.player_id
 where tsp.team_season_id=sid and (tsp.status='active' or (tsp.status is null and tsp.is_active=true)) and tsp.left_at is null;
 if p_action='roster' then return roster; end if;
 expected:=(p_args->>'revision')::integer;
 if expected is null or expected<>e.revision then raise exception 'Meldung wurde geändert. Bitte neu laden.' using errcode='40001'; end if;
 if jsonb_typeof(p_args->'players') is distinct from 'array' or jsonb_array_length(p_args->'players')>40 then
  raise exception 'Bitte maximal 40 Spieler auswählen.' using errcode='22023';
 end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_args->'players') x)<>jsonb_array_length(p_args->'players') then
  raise exception 'Spieler darf nur einmal gemeldet werden.' using errcode='22023';
 end if;
 result:='[]';
 for row_item in select * from jsonb_array_elements(p_args->'players') loop
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'id'=row_item->>'id') then
   raise exception 'Spieler gehört nicht zum aktiven Mannschaftskader.' using errcode='42501';
  end if;
  if coalesce(row_item->>'number','') !~ '^[0-9]{1,2}$' then raise exception 'Rückennummer muss zwischen 0 und 99 liegen.' using errcode='22023'; end if;
  result:=result||jsonb_build_array((select x||jsonb_build_object('number',(row_item->>'number')::integer)
   from jsonb_array_elements(roster) x where x->>'id'=row_item->>'id'));
 end loop;
 if (select count(distinct x->>'number') from jsonb_array_elements(result) x)<>jsonb_array_length(result) then
  raise exception 'Rückennummern müssen eindeutig sein.' using errcode='22023';
 end if;
 if length(coalesce(p_args->>'contactName',''))>120 or length(coalesce(p_args->>'contactPhone',''))>80
  or length(coalesce(p_args->>'jerseyColors',''))>120 then raise exception 'Angabe ist zu lang.' using errcode='22023'; end if;
 should_submit:=coalesce((p_args->>'submit')::boolean,false);
 if should_submit and (jsonb_array_length(result)=0 or trim(coalesce(p_args->>'contactName',''))='' or trim(coalesce(p_args->>'jerseyColors',''))=''
  or coalesce((p_args->>'authorized')::boolean,false)=false) then
  raise exception 'Für die Meldung bitte Spieler, Kontakt, Trikotfarben und Berechtigung ergänzen.' using errcode='22023';
 end if;
 update tournament_registration.entries set claimed_by=uid,source_team_season_id=sid,players=result,
  contact_name=trim(coalesce(p_args->>'contactName','')),contact_phone=trim(coalesce(p_args->>'contactPhone','')),
  jersey_colors=trim(coalesce(p_args->>'jerseyColors','')),status=case when should_submit then 'submitted' else 'draft' end,
  submitted_at=case when should_submit then now() else null end,confirmed_at=null,confirmed_by=null,
  revision=revision+1,updated_at=now() where id=e.id;
 return jsonb_build_object('ok',true,'revision',e.revision+1);
end;
$$;
revoke all on function public.tournament_registration_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.tournament_registration_api(text,jsonb) to authenticated;
comment on function public.tournament_registration_api(text,jsonb) is 'TEST roster registration: explicit token, ownership, staff, organizer and revision checks. No publication consent.';
