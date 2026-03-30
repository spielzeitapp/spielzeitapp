-- Optional: opponent_slug und opponent_logo_url für Logo-Anzeige (bevorzugt in getClubLogo)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS opponent_slug text NULL,
  ADD COLUMN IF NOT EXISTS opponent_logo_url text NULL;

COMMENT ON COLUMN public.events.opponent_slug IS 'Slug für Logo-Datei: /logos/<slug>.png';
COMMENT ON COLUMN public.events.opponent_logo_url IS 'Nur public/Storage-URL (kein API-Pfad)';

-- Nach Anwendung: in useEvents.ts EVENTS_SELECT um ", opponent_slug, opponent_logo_url" erweitern.
