-- Langfristiger Verletzten-Status (analog LAZ-Flag, mit Zeitraum für Nachvollziehbarkeit).

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_injured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS injured_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS injured_until timestamptz NULL;

COMMENT ON COLUMN public.players.is_injured IS
  'Langfristig verletzt: zukünftige Trainings/Spiele ohne explizite Attendance = verletzt/nicht verfügbar.';
COMMENT ON COLUMN public.players.injured_since IS
  'Beginn der aktuellen Verletzungsphase; nur Events ab diesem Zeitpunkt sind betroffen.';
COMMENT ON COLUMN public.players.injured_until IS
  'Optionales Ende der Verletzungsphase (nullable).';
