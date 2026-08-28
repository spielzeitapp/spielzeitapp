-- Kurze, prüfungsspezifische PDF-Texte je Phase.
-- Die ausführlichen Texte der Übungsbibliothek bleiben unverändert.

ALTER TABLE public.training_exam_documentation_items
  ADD COLUMN IF NOT EXISTS phase_text_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'training_exam_phase_text_overrides_object'
      AND conrelid = 'public.training_exam_documentation_items'::regclass
  ) THEN
    ALTER TABLE public.training_exam_documentation_items
      ADD CONSTRAINT training_exam_phase_text_overrides_object
      CHECK (jsonb_typeof(phase_text_overrides) = 'object');
  END IF;
END
$$;

SELECT pg_notify('pgrst', 'reload schema');
