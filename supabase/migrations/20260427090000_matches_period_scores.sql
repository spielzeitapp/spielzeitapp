ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS period_scores jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.matches.period_scores IS
'Abschnittsergebnisse 1-3 im Format {p1:{h,a},p2:{h,a},p3:{h,a}}';
