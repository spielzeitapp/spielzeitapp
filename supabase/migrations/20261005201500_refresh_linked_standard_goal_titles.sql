-- Refresh standard generated goal titles only when linked scorer and full timeline agree.
with timeline as (
  select e.*, sum((type = 'goal')::int) over (partition by match_id order by minute,created_at,id) as own_score,
    sum((type = 'goal_away')::int) over (partition by match_id order by minute,created_at,id) as opponent_score,
    count(*) filter (where type='goal') over (partition by match_id) as own_total,
    count(*) filter (where type='goal_away') over (partition by match_id) as opponent_total
  from public.match_events e where type in ('goal','goal_away')
)
update public.match_videos v
set title = 'Tor zum ' || e.own_score || ':' || e.opponent_score || ' – ' || p.first_name || ' ' || p.last_name
from timeline e, public.players p, public.matches m
where v.linked_match_event_id = e.id and e.match_id = v.match_id and e.type='goal'
  and v.scene_type='goal' and v.scene_player_id=e.player_id and p.id=v.scene_player_id
  and m.id=v.match_id and m.score_home=e.own_total and m.score_away=e.opponent_total
  and exists (select 1 from public.players oldp where oldp.team_season_id=v.team_season_id
    and v.title = 'Tor – ' || oldp.first_name || ' ' || oldp.last_name)
  and v.assist_player_id is null;
