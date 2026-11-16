-- A composite primary key on both FKs makes PostgREST infer a second teams->clubs
-- relationship. Existing teams(...clubs(...)) embeds then fail with PGRST201.
-- Keep the pair unique, but give this configuration table its own primary key.
alter table public.exchange_partner_teams add column id uuid not null default gen_random_uuid();
alter table public.exchange_partner_teams drop constraint exchange_partner_teams_pkey;
alter table public.exchange_partner_teams add constraint exchange_partner_teams_pkey primary key(id);
alter table public.exchange_partner_teams add constraint exchange_partner_teams_club_team_key unique(club_id,team_id);
notify pgrst,'reload schema';
