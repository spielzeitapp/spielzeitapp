alter table public.matches add column if not exists oefb_duration_minutes integer check (oefb_duration_minutes between 1 and 180);
comment on column public.matches.oefb_duration_minutes is 'Explicitly confirmed duration for calculated ÖFB player minutes; NULL means unconfirmed. Never infer from default planned_match_minutes.';
