-- Private logo snapshots. Uploaded files are normalized PNGs, not executable SVG or arbitrary URLs.
alter table tournament_registration.entries add column logo text check(logo is null or octet_length(logo)<=180000);
create function tournament_registration.valid_logo(p_logo text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select p_logo is null or p_logo='' or (octet_length(p_logo)<=180000 and p_logo ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$');
$$;
revoke all on function tournament_registration.valid_logo(text) from public,anon,authenticated;
create function public.tournament_registration_v3(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare base jsonb; e tournament_registration.entries%rowtype; badge text; choices jsonb; sid uuid;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501';end if;
 if p_action='set_logo' then
  select * into e from tournament_registration.entries where id=(p_args->>'id')::uuid for update;
  if e.id is null or not public.tournament_screen_is_admin((select p.tournament_event_id from public.tournament_participants p where p.id=e.participant_id)) then
   raise exception 'Nur die zuständige Turnierleitung darf das Logo ändern.' using errcode='42501';end if;
  if (p_args->>'revision')::integer is distinct from e.revision then raise exception 'Meldung wurde geändert. Bitte neu laden.' using errcode='40001';end if;
  badge:=coalesce(p_args->>'logo','');
  if not tournament_registration.valid_logo(badge) then raise exception 'Bitte ein gültiges PNG-Logo hochladen (maximal 130 KB). ' using errcode='22023';end if;
  update tournament_registration.entries set logo=badge,revision=revision+1,updated_at=now(),
   status=case when status='confirmed' then 'submitted' else status end,confirmed_at=null,confirmed_by=null where id=e.id;
  return jsonb_build_object('ok',true);
 elsif p_action='list' then
  base:=public.tournament_registration_v2(p_action,p_args);
  select coalesce(jsonb_agg(x||jsonb_build_object('logo',coalesce(r.logo,c.logo_url,'')) order by ord),'[]') into choices
  from jsonb_array_elements(base) with ordinality a(x,ord)
  left join tournament_registration.entries r on r.id=(x->>'id')::uuid
  left join public.team_seasons ts on ts.id=r.source_team_season_id
  left join public.teams t on t.id=ts.team_id left join public.clubs c on c.id=t.club_id;
  return choices;
 elsif p_action='save' then
  -- Validation and writes remain one transaction; logo failure rolls back roster changes too.
  base:=public.tournament_registration_v2(p_action,p_args);
  if p_args ? 'logoChoice' then
   if p_args->>'logoChoice'='app' then
    sid:=(p_args->>'sourceTeamSeasonId')::uuid;
    if p_args->>'registrationMode'='guest' or sid is null then raise exception 'Bitte ein Logo hochladen.' using errcode='22023';end if;
    select c.logo_url into badge from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=sid;
    if badge is not null and badge !~ '^(https://|/[^/])' then badge:=null;end if;
   else
    badge:=coalesce(p_args->>'logoChoice','');
    if not tournament_registration.valid_logo(badge) then raise exception 'Bitte ein gültiges PNG-Logo hochladen (maximal 130 KB).' using errcode='22023';end if;
   end if;
   update tournament_registration.entries set logo=coalesce(badge,'') where token_hash=encode(sha256(convert_to(p_args->>'token','UTF8')),'hex');
  end if;
  return base;
 elsif p_action='open' then
  base:=public.tournament_registration_v2(p_action,p_args);
  select * into e from tournament_registration.entries where id=(base->>'id')::uuid;
  select c.logo_url into badge from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=e.source_team_season_id;
  select coalesce(jsonb_agg(x||jsonb_build_object('logoUrl',c.logo_url) order by ord),'[]') into choices
  from jsonb_array_elements(base->'teams') with ordinality a(x,ord)
  join public.team_seasons ts on ts.id=(x->>'id')::uuid join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id;
  return base||jsonb_build_object('teams',choices,'logo',coalesce(e.logo,badge,''),'logoChoice',coalesce(e.logo,'app'));
 end if;
 return public.tournament_registration_v2(p_action,p_args);
end;
$$;
revoke all on function public.tournament_registration_v3(text,jsonb) from public,anon,authenticated;
grant execute on function public.tournament_registration_v3(text,jsonb) to authenticated;
