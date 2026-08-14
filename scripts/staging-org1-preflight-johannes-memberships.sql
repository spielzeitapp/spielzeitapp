select m.user_id, m.role::text, m.team_season_id, t.name as team_name, c.name as club_name, ts.status
from memberships m
join team_seasons ts on ts.id = m.team_season_id
join teams t on t.id = ts.team_id
join clubs c on c.id = t.club_id
where m.user_id = 'ddb3105e-1d96-49e3-b468-89db2c2520cf'
order by c.name, t.name;
