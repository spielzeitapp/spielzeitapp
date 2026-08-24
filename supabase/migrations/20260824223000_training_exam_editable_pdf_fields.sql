-- Bearbeitbare Prüfungsangaben für Teil- und Gesamtexporte.
-- Die offizielle PDF-Vorlage bleibt unverändert; nur die eingetragenen Werte sind editierbar.

ALTER TABLE public.training_exam_documentations
  ADD COLUMN IF NOT EXISTS trainer_name text NOT NULL DEFAULT '';

ALTER TABLE public.training_exam_documentation_items
  ADD COLUMN IF NOT EXISTS focus_override text NULL,
  ADD COLUMN IF NOT EXISTS team_name_override text NULL,
  ADD COLUMN IF NOT EXISTS training_date_override date NULL;

SELECT pg_notify('pgrst', 'reload schema');
