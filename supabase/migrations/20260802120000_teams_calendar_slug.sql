-- Dauerhafte Kalender-Identität pro Team (saison-/altersklassenunabhängig).
-- Bestehende Abos (spg-rohrbach / u11-spg-rohrbach) bleiben über calendar_slug + Legacy-Resolver gültig.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS calendar_slug text;

COMMENT ON COLUMN public.teams.calendar_slug IS
  'Dauerhafter öffentlicher ICS-Slug (z. B. spg-rohrbach). Unabhängig von Altersklasse/Saison.';

-- Normalisierung: lowercase, nur [a-z0-9-]
CREATE OR REPLACE FUNCTION public.normalize_calendar_slug(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '-' from regexp_replace(
        lower(
          translate(
            regexp_replace(coalesce(raw, ''), '^\s*[Uu]\d{1,2}[a-zA-Z]?\s+', ''),
            'äöüßÄÖÜ',
            'aousAOU'
          )
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'team'
  );
$$;

-- Basis für Nummerierung: letzter aussagekräftiger Namens-Token (≥4 Zeichen),
-- sonst vollständiger Name ohne Altersklasse.
CREATE OR REPLACE FUNCTION public.calendar_slug_base_from_team_name(team_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  stripped text;
  parts text[];
  last_tok text;
  i int;
BEGIN
  stripped := regexp_replace(coalesce(team_name, ''), '^\s*[Uu]\d{1,2}[a-zA-Z]?\s+', '');
  stripped := trim(stripped);
  IF stripped = '' THEN
    RETURN 'team';
  END IF;
  parts := regexp_split_to_array(stripped, '\s+');
  i := array_length(parts, 1);
  WHILE i >= 1 LOOP
    last_tok := parts[i];
    IF char_length(last_tok) >= 4 THEN
      RETURN public.normalize_calendar_slug(last_tok);
    END IF;
    i := i - 1;
  END LOOP;
  RETURN public.normalize_calendar_slug(stripped);
END;
$$;

-- Nächsten freien Slug {base}-N vergeben (überspringt belegte).
CREATE OR REPLACE FUNCTION public.allocate_numbered_calendar_slug(base_raw text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  base := public.normalize_calendar_slug(base_raw);
  IF base = '' OR base = 'team' THEN
    base := 'team';
  END IF;

  LOOP
    candidate := base || '-' || n::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teams t WHERE lower(t.calendar_slug) = candidate
    );
    n := n + 1;
    IF n > 9999 THEN
      RAISE EXCEPTION 'calendar_slug allocation exhausted for base %', base;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.teams_assign_calendar_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  preferred text;
BEGIN
  IF NEW.calendar_slug IS NOT NULL AND length(trim(NEW.calendar_slug)) > 0 THEN
    NEW.calendar_slug := public.normalize_calendar_slug(NEW.calendar_slug);
    RETURN NEW;
  END IF;

  -- Bekanntes Live/Staging-Team: bestehenden öffentlichen Slug behalten.
  IF NEW.id = '1ebe3d18-78ff-4986-a0b2-31cc1b7af938'::uuid THEN
    NEW.calendar_slug := 'spg-rohrbach';
    RETURN NEW;
  END IF;

  preferred := public.calendar_slug_base_from_team_name(NEW.name);
  NEW.calendar_slug := public.allocate_numbered_calendar_slug(preferred);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_assign_calendar_slug ON public.teams;
CREATE TRIGGER trg_teams_assign_calendar_slug
  BEFORE INSERT OR UPDATE OF name, calendar_slug
  ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.teams_assign_calendar_slug();

-- Backfill bestehende Teams (Zeile für Zeile, keine Kollisionen)
DO $$
DECLARE
  r record;
BEGIN
  UPDATE public.teams
  SET calendar_slug = 'spg-rohrbach'
  WHERE id = '1ebe3d18-78ff-4986-a0b2-31cc1b7af938'::uuid
    AND (calendar_slug IS NULL OR btrim(calendar_slug) = '');

  FOR r IN
    SELECT id, name
    FROM public.teams
    WHERE calendar_slug IS NULL OR btrim(calendar_slug) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE public.teams
    SET calendar_slug = public.allocate_numbered_calendar_slug(
      public.calendar_slug_base_from_team_name(r.name)
    )
    WHERE id = r.id;
  END LOOP;
END $$;

-- Unique (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_calendar_slug_unique
  ON public.teams (lower(calendar_slug));

ALTER TABLE public.teams
  ALTER COLUMN calendar_slug SET NOT NULL;
