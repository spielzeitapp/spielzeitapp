-- Trainerprüfung: Einheiten können vorbereitet bleiben, aber einzeln für den
-- aktuellen PDF-Export ein- oder ausgeschlossen werden.

ALTER TABLE public.training_exam_documentation_items
  ADD COLUMN IF NOT EXISTS included_in_pdf boolean NOT NULL DEFAULT true;

SELECT pg_notify('pgrst', 'reload schema');
