-- Optional: Spielart für Spiele (Meisterschaftsspiel, Freundschaftsspiel, Turnier, Testspiel, …)
-- Nach Anwendung: useEvents EVENTS_SELECT enthält bereits match_type.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS match_type text NULL;

COMMENT ON COLUMN public.events.match_type IS 'Spielart: league, friendly, tournament, test, cup, other';
