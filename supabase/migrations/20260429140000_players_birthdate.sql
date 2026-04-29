-- Optional birth date for age display and future birthday feed.
alter table public.players
  add column if not exists birthdate date;

comment on column public.players.birthdate is 'Player date of birth; used for age and birthday greetings.';
