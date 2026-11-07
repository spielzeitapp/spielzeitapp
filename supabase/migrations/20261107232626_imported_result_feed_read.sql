-- Read-only imported result cards. Fans need no publishing rights; settings remain authoritative.
create or replace function public.read_imported_result_feed(p_team_season_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('team',jsonb_build_object('id',ts.team_id,'name',t.name),
 'events',coalesce((select jsonb_agg(jsonb_build_object(
  'id',e.id,'team_season_id',e.team_season_id,'match_id',e.match_id,'starts_at',e.starts_at,
  'is_home',e.is_home,'opponent',e.opponent,'opponent_logo_url',e.opponent_logo_url,
  'location',e.location,'match_type',e.match_type,
  'matches',jsonb_build_object('status',m.status,'score_home',m.score_home,'score_away',m.score_away)) order by e.starts_at desc)
 from public.events e join public.matches m on m.id=e.match_id and m.team_season_id=e.team_season_id
 left join public.event_feed_settings s on s.event_id=e.id
 where e.team_season_id=ts.id and e.external_source='oefb' and m.status='finished'
 and e.starts_at<=now() and m.score_home is not null and m.score_away is not null
 and coalesce(s.feed_automation_enabled,true) and coalesce(s.result_feed_enabled,true)
 and not exists(select 1 from public.team_feed_dedupe_suppressions d where d.dedupe_key='result_feed:'||m.id::text)
 and not exists(select 1 from public.team_feed_posts p where p.team_season_id=ts.id
  and (p.post_kind='result_auto' or p.media_type='result') and (p.event_id=e.id or p.payload->>'match_id'=m.id::text))
 ),'[]'::jsonb))
from public.team_seasons ts join public.teams t on t.id=ts.team_id
where ts.id=p_team_season_id and auth.uid() is not null and public.can_read_team_season(ts.id)
$$;
revoke all on function public.read_imported_result_feed(uuid) from public,anon;
grant execute on function public.read_imported_result_feed(uuid) to authenticated;
