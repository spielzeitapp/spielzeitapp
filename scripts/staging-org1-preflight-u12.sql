select ts.id, ts.status, t.name as team_name, t.id as team_id, s.name as season_name
from team_seasons ts
join teams t on t.id = ts.team_id
left join seasons s on s.id = ts.season_id
where ts.id = '5dd421cd-b47f-4889-8867-9bc1fa451c09'
   or (t.club_id = '9c7a8741-6e73-42d5-88d8-46ce5217e8cd' and t.name ilike '%U12%')
order by t.name, ts.status;
