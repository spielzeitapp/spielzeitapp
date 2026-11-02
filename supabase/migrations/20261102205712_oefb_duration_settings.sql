alter table public.team_seasons add column oefb_duration_default_minutes integer check(oefb_duration_default_minutes between 1 and 180);
comment on column public.team_seasons.oefb_duration_default_minutes is 'Staff-confirmed duration used for calculated imported appearances only; per-match override takes precedence. NULL means unconfirmed.';
create function public.save_oefb_duration(p_team_season_id uuid,p_match_id uuid,p_minutes integer,p_expected integer)
returns void language plpgsql security definer set search_path='' as $$
declare previous integer;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin() or public.membership_is_staff_for_team_season(p_team_season_id),false) then raise exception 'Trainer access required' using errcode='42501'; end if;
 if p_minutes is not null and (p_minutes<1 or p_minutes>180) then raise exception 'Spieldauer muss zwischen 1 und 180 Minuten liegen'; end if;
 select ts.oefb_duration_default_minutes into previous from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' for update of ts;
 if not found then raise exception 'Saison schreibgeschützt' using errcode='42501'; end if;
 if p_match_id is null then
  if previous is distinct from p_expected then raise exception 'Spieldauer inzwischen geändert. Neu laden.' using errcode='40001'; end if;
  update public.team_seasons set oefb_duration_default_minutes=p_minutes where id=p_team_season_id;
 else
  select m.oefb_duration_minutes into previous from public.matches m where m.id=p_match_id and m.team_season_id=p_team_season_id and m.status='finished' and m.live_started_at is null and coalesce(m.live_elapsed_seconds,0)=0 and exists(select 1 from public.events e where e.match_id=m.id and e.team_season_id=p_team_season_id and e.external_source='oefb') and not exists(select 1 from public.match_events me where me.match_id=m.id) for update of m;
  if not found then raise exception 'Nur importierte Spiele ohne interne Live-Aufzeichnung können hier geändert werden' using errcode='42501'; end if;
  if previous is distinct from p_expected then raise exception 'Spieldauer inzwischen geändert. Neu laden.' using errcode='40001'; end if;
  update public.matches set oefb_duration_minutes=p_minutes where id=p_match_id;
 end if;
end $$;
revoke all on function public.save_oefb_duration(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.save_oefb_duration(uuid,uuid,integer,integer) to authenticated;
