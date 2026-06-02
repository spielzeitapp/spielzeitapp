-- Geplante Spieldauer pro Spiel (Live-Timer-Hinweise, Mindestspielzeit, Dringlichkeit).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS planned_match_minutes integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN public.matches.planned_match_minutes IS
  'Geplante Spieldauer in Minuten für Live-Spiel, Mindestspielzeit und Dringlichkeitslogik.';
