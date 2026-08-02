-- Meisterschaft: dritter Status published (Eltern-sichtbar).
-- open = Arbeitsliste; agreed = vereinbart intern; published = finaler Termin.
-- NULL bleibt normales Event (Training, Freundschaft, Turnier, …).
-- WICHTIG: Nur manuell auf Staging/Live anwenden.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_fixture_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_fixture_status_check
  CHECK (
    fixture_status IS NULL
    OR fixture_status IN ('open', 'agreed', 'published')
  );

COMMENT ON COLUMN public.events.fixture_status IS
  'open = Meisterschafts-Arbeitsliste; agreed = mit Gegner vereinbart (intern); published = für Eltern sichtbar; NULL = normales Event.';
