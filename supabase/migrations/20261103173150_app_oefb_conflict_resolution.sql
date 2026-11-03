alter table public.events add column oefb_sync_ignored jsonb;

-- Acknowledged source values stay silent until either source or trainer value changes.
do $patch$
declare definition text; item text; replacement text;
begin
 select pg_get_functiondef('oefb_sync.reconcile(uuid,text,jsonb)'::regprocedure) into definition;
 foreach item in array array[
  'jsonb_build_object(''field'',''starts_at'',''trainer'',e.starts_at,''oefb'',kick)',
  'jsonb_build_object(''field'',''score'',''trainer'',m.score_home||'':''||m.score_away,''oefb'',sh||'':''||sa)'
 ] loop
  replacement:='case when oefb_sync_ignored='||item||' then null else '||item||' end';
  if position('set oefb_sync_conflict='||item in definition)=0 then raise exception 'Expected conflict guard missing'; end if;
  definition:=replace(definition,'set oefb_sync_conflict='||item,'set oefb_sync_conflict='||replacement);
 end loop;
 execute definition;
end $patch$;

create function public.resolve_oefb_event_conflict(p_event uuid,p_expected jsonb,p_choice text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype; m public.matches%rowtype; kickoff timestamptz; sh integer; sa integer;
begin
 select * into e from public.events where id=p_event;
 if not found or auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(e.team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=e.team_season_id and ts.status='active' and c.status='active' for share of ts;
 if not found then raise exception 'Saison ist schreibgeschützt.'; end if;
 select * into e from public.events where id=p_event for update;
 if p_expected is null or e.oefb_sync_conflict is null or e.oefb_sync_conflict is distinct from p_expected then raise exception 'Hinweis wurde inzwischen geändert. Bitte neu laden.'; end if;
 if p_choice not in ('keep','source') or p_choice is null then raise exception 'Ungültige Entscheidung'; end if;
 if e.match_id is not null then select * into m from public.matches where id=e.match_id and team_season_id=e.team_season_id for update; if not found then raise exception 'Spielzuordnung wurde geändert'; end if; end if;
 -- Compare trainer value too: a stale dialog must never overwrite a newer edit.
 if p_expected->>'field'='starts_at' then
  if e.starts_at is distinct from (p_expected->>'trainer')::timestamptz then raise exception 'Trainertermin wurde inzwischen geändert. Bitte neu laden.'; end if;
 elsif p_expected->>'field'='score' then
  if e.match_id is null or (m.score_home||':'||m.score_away) is distinct from p_expected->>'trainer' then raise exception 'Ergebnis wurde inzwischen geändert. Bitte neu laden.'; end if;
 else raise exception 'Unbekannter Konflikt'; end if;
 if p_choice='keep' then
  update public.events set oefb_sync_ignored=p_expected,oefb_sync_conflict=null where id=e.id;
  return;
 end if;
 if lower(e.status) in ('cancelled','canceled','deleted') then raise exception 'Abgesagtes Spiel bitte manuell prüfen.'; end if;
 if e.match_id is not null and (m.live_started_at is not null or coalesce(m.live_elapsed_seconds,0)<>0 or exists(select 1 from public.match_events where match_id=m.id)) then raise exception 'Eigene Spielaufzeichnung vorhanden. Bitte im Spiel manuell korrigieren; sie bleibt geschützt.'; end if;
 if p_expected->>'field'='starts_at' then
  kickoff:=(p_expected->>'oefb')::timestamptz;
  update public.events set starts_at=kickoff,source_starts_at=kickoff,oefb_sync_conflict=null,oefb_sync_ignored=null where id=e.id;
  if e.match_id is not null then update public.matches set match_date=kickoff where id=e.match_id; end if;
  update public.team_feed_posts set payload=payload||jsonb_build_object('starts_at',kickoff),updated_at=now() where event_id=e.id and post_kind='result_auto';
 else
  if coalesce(p_expected->>'oefb','') !~ '^[0-9]{1,2}:[0-9]{1,2}$' then raise exception 'Ungültiger ÖFB-Endstand'; end if;
  sh:=split_part(p_expected->>'oefb',':',1)::integer; sa:=split_part(p_expected->>'oefb',':',2)::integer;
  update public.matches set score_home=sh,score_away=sa,status='finished' where id=e.match_id;
  update public.events set status='finished',oefb_sync_conflict=null,oefb_sync_ignored=null where id=e.id;
  update public.team_feed_posts set payload=payload||jsonb_build_object('home_score',sh,'away_score',sa,'result_state',case when sh=sa then 'draw' when (sh>sa)=e.is_home then 'win' else 'loss' end),
   caption='⚽ ENDSTAND! '||coalesce(payload->>'home_team_name','Heim')||' '||sh||':'||sa||' '||coalesce(payload->>'away_team_name','Gast'),updated_at=now()
   where event_id=e.id and post_kind='result_auto';
 end if;
end $$;
revoke all on function public.resolve_oefb_event_conflict(uuid,jsonb,text) from public,anon;
grant execute on function public.resolve_oefb_event_conflict(uuid,jsonb,text) to authenticated;
