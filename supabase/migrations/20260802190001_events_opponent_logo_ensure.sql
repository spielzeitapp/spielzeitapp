-- Staging-Drift-Reparatur: opponent_logo_url (bereits in älteren Migrationen vorgesehen).
-- Idempotent — auf Live harmlos falls Spalte schon existiert.
-- WICHTIG: Nur manuell anwenden.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS opponent_logo_url text NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS opponent_slug text NULL;

COMMENT ON COLUMN public.events.opponent_logo_url IS
  'Gegnerlogo: public/logos/… oder erlaubte Storage-/HTTPS-URL.';
COMMENT ON COLUMN public.events.opponent_slug IS
  'Optionaler Logo-Slug für lokale /logos/<slug>.png Auflösung.';
