select t.id, t.name, t.club_id, t.age_group
from teams t
where t.club_id = '3db6fce2-a4c1-44a5-a333-19d1d4d62e6a'
order by t.name;
