-- Mindestspielzeit pro Spiel (Trainer-Hinweis, kein Hard-Block).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS minimum_playtime_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS minimum_playtime_minutes integer NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.matches.minimum_playtime_enabled IS
  'Trainer: Mindestspielzeit-Hinweise in Live (Wechselvorschläge, Statistik, Spielende).';

COMMENT ON COLUMN public.matches.minimum_playtime_minutes IS
  'Ziel-Minuten pro Spieler wenn minimum_playtime_enabled.';
