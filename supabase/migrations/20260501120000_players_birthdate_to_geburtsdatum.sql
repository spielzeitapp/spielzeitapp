-- Align column name with PostgREST / app: quoted identifier "Geburtsdatum".
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'birthdate'
  ) then
    alter table public.players rename column birthdate to "Geburtsdatum";
  end if;
end $$;
