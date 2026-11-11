alter table public.matches drop constraint if exists matches_u11_formation_id_check;
alter table public.matches add constraint matches_u11_formation_id_check check (u11_formation_id is null or u11_formation_id in ('1-2-2-2','1-2-3-1','1-3-2-1','1-3-3','1-3-3-1','1-4-3','1-3-4','1-2-2','1-2-1-2'));
