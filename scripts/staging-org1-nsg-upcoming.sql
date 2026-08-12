select e.id, e.kind, e.type, e.starts_at, e.opponent, e.is_home, e.team_season_id
from events e
where e.team_season_id = '5dd421cd-b47f-4889-8867-9bc1fa451c09'
  and e.starts_at > now()
order by e.starts_at
limit 15;
