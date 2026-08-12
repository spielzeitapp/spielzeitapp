select v.id, v.name, v.club_id, c.name as club_name
from venues v
left join clubs c on c.id = v.club_id
order by v.name;
