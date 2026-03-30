-- Separate Adresse + Serien für wiederkehrende Trainings/Events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS address text NULL,
  ADD COLUMN IF NOT EXISTS series_id uuid NULL;

COMMENT ON COLUMN public.events.address IS 'Straße, PLZ Ort (getrennt von location/Platzname)';
COMMENT ON COLUMN public.events.series_id IS 'Gemeinsame ID für alle Instanzen einer Termin-Serie';

CREATE INDEX IF NOT EXISTS idx_events_series_id ON public.events(series_id) WHERE series_id IS NOT NULL;
