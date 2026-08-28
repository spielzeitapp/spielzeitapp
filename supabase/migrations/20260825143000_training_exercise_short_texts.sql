-- Wiederverwendbare, bearbeitbare Kurzfassungen für Trainer-PDF, Handout und Word.
-- Die ausführlichen Bibliothekstexte bleiben unverändert erhalten.

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS short_content text NULL,
  ADD COLUMN IF NOT EXISTS short_materials text NULL,
  ADD COLUMN IF NOT EXISTS short_coaching text NULL;

COMMENT ON COLUMN public.training_exercises.short_content IS
  'Bearbeitbare Stichpunkte zu Aufbau und Ablauf für kompakte Exporte.';
COMMENT ON COLUMN public.training_exercises.short_materials IS
  'Bearbeitete kompakte Materialliste für kompakte Exporte.';
COMMENT ON COLUMN public.training_exercises.short_coaching IS
  'Bearbeitbare Coaching-Stichpunkte für kompakte Exporte.';

SELECT pg_notify('pgrst', 'reload schema');
