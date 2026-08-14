select vf.id, vf.name, vf.venue_id, v.name as venue_name
from venue_fields vf
join venues v on v.id = vf.venue_id
where v.id in ('ec1ba01f-cc58-4c91-b524-463b510ca339','ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c')
order by v.name, vf.name;
