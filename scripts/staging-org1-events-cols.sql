select column_name from information_schema.columns
where table_schema='public' and table_name='events' and column_name in ('notes','title','location','status','meeting_at','ends_at','starts_at','kind','type','is_home','opponent','venue_id')
order by 1;
