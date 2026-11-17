-- Step 1: private guest-team registrations, no club/team/player creation.
alter table tournament_registration.entries add column guest_details jsonb not null default '{}'::jsonb check(jsonb_typeof(guest_details)='object');
create function public.tournament_registration_v2(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare base jsonb; e tournament_registration.entries%rowtype; result jsonb; item jsonb;
 token text; first_name text; last_name text; birth_year integer; jersey integer; submit boolean; expected integer;
 club_name text:=trim(coalesce(p_args->>'clubName','')); team_name text:=trim(coalesce(p_args->>'guestTeamName',''));
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if p_action='list' then
  -- Existing gateway performs the current organizer check before any private read.
  base:=public.tournament_registration_api('list',p_args);
  select coalesce(jsonb_agg(x||jsonb_build_object('guestDetails',r.guest_details)), '[]') into result
  from jsonb_array_elements(base) x left join tournament_registration.entries r on r.id=(x->>'id')::uuid;
  return result;
 elsif p_action='save' and p_args->>'registrationMode'='guest' then
  -- Reuses token expiry/revocation/claimant/current-staff validation and row lock.
  base:=public.tournament_registration_api('open',jsonb_build_object('token',p_args->>'token'));
  select * into e from tournament_registration.entries where id=(base->>'id')::uuid for update;
  expected:=(p_args->>'revision')::integer;
  if expected is null or expected<>e.revision then raise exception 'Meldung wurde geändert. Bitte neu laden.' using errcode='40001'; end if;
  if length(club_name)>120 or length(team_name)>120 or length(coalesce(p_args->>'contactName',''))>120
   or length(coalesce(p_args->>'contactPhone',''))>80 or length(coalesce(p_args->>'jerseyColors',''))>120 then
   raise exception 'Angabe ist zu lang.' using errcode='22023'; end if;
  if jsonb_typeof(p_args->'players') is distinct from 'array' or jsonb_array_length(p_args->'players')>40 then
   raise exception 'Maximal 40 Spieler möglich.' using errcode='22023'; end if;
  submit:=coalesce((p_args->>'submit')::boolean,false); result:='[]';
  for item in select * from jsonb_array_elements(p_args->'players') loop
   if item->>'id' is null or item->>'id' !~ '^guest:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or item ? 'sourcePlayerId' then raise exception 'Ungültige Gastspieler-ID.' using errcode='22023'; end if;
   first_name:=trim(coalesce(item->>'firstName','')); last_name:=trim(coalesce(item->>'lastName',''));
   if length(first_name)>80 or length(last_name)>80 then raise exception 'Spielername ist zu lang.' using errcode='22023'; end if;
   birth_year:=null;jersey:=null;
   if coalesce(item->>'birthYear','')<>'' then
    if item->>'birthYear' !~ '^[0-9]{4}$' then raise exception 'Jahrgang muss vierstellig sein.' using errcode='22023'; end if;
    birth_year:=(item->>'birthYear')::integer;
    if birth_year<extract(year from now())::integer-100 or birth_year>extract(year from now())::integer then raise exception 'Jahrgang ist ungültig.' using errcode='22023'; end if;
   end if;
   if coalesce(item->>'number','')<>'' then
    if item->>'number' !~ '^[0-9]{1,2}$' then raise exception 'Rückennummer muss zwischen 0 und 99 liegen.' using errcode='22023'; end if;
    jersey:=(item->>'number')::integer;
   end if;
   if submit and (first_name='' or last_name='' or birth_year is null or jersey is null) then
    raise exception 'Bitte Name, Jahrgang und Nummer aller Spieler ergänzen.' using errcode='22023'; end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','firstName',first_name,'lastName',last_name,'birthYear',birth_year,'number',jersey));
  end loop;
  if (select count(distinct x->>'id') from jsonb_array_elements(result)x)<>jsonb_array_length(result) then raise exception 'Spieler doppelt vorhanden.' using errcode='22023';end if;
  if (select count(x->>'number')-count(distinct x->>'number') from jsonb_array_elements(result)x)>0 then raise exception 'Rückennummern müssen eindeutig sein.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(result)x where trim(x->>'firstName')<>'' and trim(x->>'lastName')<>'' group by lower(trim(x->>'firstName')),lower(trim(x->>'lastName')),x->>'birthYear' having count(*)>1) then
   raise exception 'Spieler mit gleichem Namen und Jahrgang doppelt vorhanden.' using errcode='22023';end if;
  if submit and (club_name='' or team_name='' or trim(coalesce(p_args->>'contactName',''))='' or trim(coalesce(p_args->>'jerseyColors',''))=''
   or jsonb_array_length(result)=0 or coalesce((p_args->>'authorized')::boolean,false)=false) then
   raise exception 'Bitte Verein, Mannschaft, Kontakt, Trikotfarben, Spieler und Berechtigung ergänzen.' using errcode='22023'; end if;
  update tournament_registration.entries set claimed_by=auth.uid(),source_team_season_id=null,
   guest_details=jsonb_build_object('clubName',club_name,'teamName',team_name),players=result,
   contact_name=trim(coalesce(p_args->>'contactName','')),contact_phone=trim(coalesce(p_args->>'contactPhone','')),
   jersey_colors=trim(coalesce(p_args->>'jerseyColors','')),status=case when submit then 'submitted' else 'draft' end,
   submitted_at=case when submit then now() else null end,confirmed_at=null,confirmed_by=null,revision=revision+1,updated_at=now() where id=e.id;
  return jsonb_build_object('ok',true,'revision',e.revision+1);
 else
  base:=public.tournament_registration_api(p_action,p_args);
  if p_action='open' then
   select * into e from tournament_registration.entries where id=(base->>'id')::uuid;
   return base||jsonb_build_object('registrationMode',case when e.source_team_season_id is null and e.guest_details<>'{}' then 'guest' else 'app' end,'guestDetails',e.guest_details);
  elsif p_action='save' then
   -- The app save already validated and locked the invitation.
   token:=p_args->>'token';
   update tournament_registration.entries set guest_details='{}' where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
  end if;
  return base;
 end if;
end;
$$;
revoke all on function public.tournament_registration_v2(text,jsonb) from public,anon,authenticated;
grant execute on function public.tournament_registration_v2(text,jsonb) to authenticated;
