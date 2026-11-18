-- Missing App birth years belong to the private tournament snapshot, never the source profile.
create or replace function public.tournament_registration_v4(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare base jsonb; opened jsonb; e tournament_registration.entries%rowtype; row_item jsonb; incoming jsonb; result jsonb:='[]'; year_text text; year_value integer;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501';end if;
 if p_action='save' and coalesce(p_args->>'registrationMode','app')<>'guest' then
  base:=public.tournament_registration_v3(p_action,p_args);
  -- Source roster authorization, player IDs, revision and write lock were validated above.
  select * into e from tournament_registration.entries where token_hash=encode(sha256(convert_to(p_args->>'token','UTF8')),'hex');
  for row_item in select * from jsonb_array_elements(e.players) loop
   row_item:=row_item||jsonb_build_object('birthYear',coalesce((select extract(year from pp.birthdate)::integer from public.player_profiles pp where pp.player_id=(row_item->>'id')::uuid), (row_item->>'birthYear')::integer));
   select x into incoming from jsonb_array_elements(p_args->'players') x where x->>'id'=row_item->>'id';
   year_text:=nullif(incoming->>'birthYear','');
   if year_text is not null and (year_text !~ '^[0-9]{4}$' or length(year_text)<>4) then raise exception 'Jahrgang muss vierstellig sein.' using errcode='22023';end if;
   year_value:=year_text::integer;
   if year_value is not null and (year_value<extract(year from now())::integer-100 or year_value>extract(year from now())::integer) then raise exception 'Jahrgang ist ungültig.' using errcode='22023';end if;
   if row_item->>'birthYear' is not null then
    if year_value is not null and year_value<>(row_item->>'birthYear')::integer then raise exception 'Vorhandener App-Jahrgang kann hier nicht geändert werden.' using errcode='22023';end if;
    row_item:=row_item||jsonb_build_object('birthYearSource','app');
   else
    if coalesce((p_args->>'submit')::boolean,false) and year_value is null then raise exception 'Bitte fehlende Jahrgänge im Turnierkader ergänzen.' using errcode='22023';end if;
    row_item:=row_item||jsonb_build_object('birthYear',year_value,'birthYearSource',case when year_value is null then null else 'registration' end);
   end if;
   result:=result||jsonb_build_array(row_item);
  end loop;
  update tournament_registration.entries set players=result where id=e.id;
  return base;
 elsif p_action='roster' then
  base:=public.tournament_registration_v3(p_action,p_args);
  -- The gateway already validated token/claimant AND staff access to the requested team.
  select * into e from tournament_registration.entries where token_hash=encode(sha256(convert_to(p_args->>'token','UTF8')),'hex') and source_team_season_id=(p_args->>'sourceTeamSeasonId')::uuid;
  for row_item in select * from jsonb_array_elements(base) loop
   row_item:=row_item||jsonb_build_object('birthYear',coalesce((select extract(year from pp.birthdate)::integer from public.player_profiles pp where pp.player_id=(row_item->>'id')::uuid), (row_item->>'birthYear')::integer));
   select x into incoming from jsonb_array_elements(coalesce(e.players,'[]')) x where x->>'id'=row_item->>'id';
   if row_item->>'birthYear' is not null then row_item:=row_item||jsonb_build_object('birthYearSource','app');
   elsif incoming->>'birthYearSource'='registration' then row_item:=row_item||jsonb_build_object('birthYear',incoming->'birthYear','birthYearSource','registration');end if;
   result:=result||jsonb_build_array(row_item);
  end loop;
  return result;
 end if;
 return public.tournament_registration_v3(p_action,p_args);
end;
$$;
revoke all on function public.tournament_registration_v4(text,jsonb) from public,anon,authenticated;
grant execute on function public.tournament_registration_v4(text,jsonb) to authenticated;
