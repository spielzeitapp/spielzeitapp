-- Turnier als eigener events.kind (MVP Step 1, noch keine Turnierspiele).

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_kind_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_kind_check
  CHECK (kind IS NULL OR kind IN ('match', 'training', 'event', 'tournament'));

COMMENT ON COLUMN public.events.kind IS
  'Terminart: match | training | event | tournament';

SELECT pg_notify('pgrst', 'reload schema');
