-- The optional goal-import module is not installed in every environment.
create or replace function match_review_private.set_match_no_show(p_match_id uuid, p_player_id uuid, p_absent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_official_goal boolean := false;
begin
  if v_uid is null then raise exception 'Anmeldung erforderlich.' using errcode = '42501'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Spiel nicht gefunden.'; end if;
  if not (public.match_staff_can_write_for_match(p_match_id) or exists (
    select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
    where ts.id=v_match.team_season_id and public.is_club_admin_for_club(t.club_id)
  )) then raise exception 'Keine Berechtigung für diesen Kader.' using errcode='42501'; end if;
  if not public.team_season_is_writable(v_match.team_season_id) then raise exception 'Archivierte Saison ist schreibgeschützt.'; end if;
  if v_match.status <> 'finished' or v_match.status is null then raise exception 'Korrektur erst nach Spielende möglich.'; end if;
  if p_absent is null then raise exception 'Anwesenheitsstatus fehlt.'; end if;
  if p_absent then
    if exists(select 1 from public.match_no_shows where match_id=p_match_id and player_id=p_player_id and reverted_at is null) then return; end if;
    if not exists(select 1 from public.match_bench where match_id=p_match_id and player_id=p_player_id) then raise exception 'Spieler ist nicht auf der Ersatzbank.'; end if;
    if to_regclass('public.oefb_goal_attributions') is not null then
      execute 'select exists(select 1 from public.oefb_goal_attributions where match_id=$1 and player_id=$2)' into v_official_goal using p_match_id,p_player_id;
    end if;
    if exists(select 1 from public.match_lineup where match_id=p_match_id and player_id=p_player_id)
      or exists(select 1 from public.match_lineup_slots where match_id=p_match_id and player_id=p_player_id)
      or exists(select 1 from public.match_lineup_snapshots where match_id=p_match_id and player_id=p_player_id)
      or exists(select 1 from public.match_events where match_id=p_match_id and (
        player_id=p_player_id or related_player_id=p_player_id or payload->>'player_in_id'=p_player_id::text or payload->>'player_out_id'=p_player_id::text
      ))
      or v_official_goal
    then raise exception 'Für diesen Spieler ist ein Einsatz oder Spielereignis protokolliert. Bitte zuerst den Spielbericht prüfen.'; end if;
    insert into public.match_no_shows (match_id,player_id,recorded_by) values(p_match_id,p_player_id,v_uid)
    on conflict(match_id,player_id) do update set recorded_by=v_uid,recorded_at=now(),reverted_by=null,reverted_at=null;
    delete from public.match_bench where match_id=p_match_id and player_id=p_player_id;
  else
    if not exists(select 1 from public.match_no_shows where match_id=p_match_id and player_id=p_player_id and reverted_at is null) then return; end if;
    insert into public.match_bench(match_id,player_id) values(p_match_id,p_player_id) on conflict do nothing;
    update public.match_no_shows set reverted_by=v_uid,reverted_at=now() where match_id=p_match_id and player_id=p_player_id;
  end if;
end;
$$;
