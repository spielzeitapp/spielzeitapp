select id, name, short_name, status, archived_at is not null as archived
from clubs
order by name;
