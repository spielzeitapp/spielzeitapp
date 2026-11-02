-- Intentional read-only definer: fans may read confirmed football identity mappings
-- for readable seasons without gaining access to staff-only confirmation metadata.
-- No writes; auth.uid() and can_read_team_season checked for every returned row.
create or replace function public.read_oefb_stat_links(p_team_season_ids uuid[]) returns table(team_season_id uuid,external_player_id text,player_id uuid,source_name text) language sql stable security definer set search_path=public,pg_temp as $$ select l.team_season_id,l.external_player_id,l.player_id,l.source_name from public.oefb_player_links l where auth.uid() is not null and l.team_season_id=any(p_team_season_ids) and public.can_read_team_season(l.team_season_id) $$;
revoke all on function public.read_oefb_stat_links(uuid[]) from public,anon;
grant execute on function public.read_oefb_stat_links(uuid[]) to authenticated;
