-- Offizieller externer Turnierplan-Link (MVP Step 6).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS official_tournament_url text NULL;

COMMENT ON COLUMN public.events.official_tournament_url IS
  'Optionaler Link zum offiziellen externen Turnierplan (z.B. meinTurnierplan).';

SELECT pg_notify('pgrst', 'reload schema');
