ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS link text NULL;

COMMENT ON COLUMN public.messages.link IS 'Optionaler App-Pfad (z. B. Team-Push)';

SELECT pg_notify('pgrst', 'reload schema');
