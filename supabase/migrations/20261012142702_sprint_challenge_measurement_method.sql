ALTER TABLE public.challenge_sessions
ADD COLUMN IF NOT EXISTS measurement_method text
CHECK (measurement_method IS NULL OR measurement_method IN ('hand','light_gate'));
COMMENT ON COLUMN public.challenge_sessions.measurement_method IS 'Sprint test timing method; NULL for previous tests until explicitly classified.';
