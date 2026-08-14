select f.id, f.name, f.venue_id, v.name as venue_name
from fields f
join venues v on v.id = f.venue_id
where v.id in (
  select id from venues where name ilike '%rohrbach%' or name ilike '%veit%'
)
order by v.name, f.name;
