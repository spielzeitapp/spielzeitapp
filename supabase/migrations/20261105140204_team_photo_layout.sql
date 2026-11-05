-- Display-only settings. Original image URL and existing RLS remain in force.
ALTER TABLE public.team_photos
 ADD COLUMN photo_zoom integer NOT NULL DEFAULT 100 CHECK(photo_zoom BETWEEN 100 AND 220),
 ADD COLUMN photo_position_x integer NOT NULL DEFAULT 50 CHECK(photo_position_x BETWEEN 0 AND 100),
 ADD COLUMN photo_position_y integer NOT NULL DEFAULT 50 CHECK(photo_position_y BETWEEN 0 AND 100),
 ADD COLUMN photo_brightness integer NOT NULL DEFAULT 100 CHECK(photo_brightness BETWEEN 50 AND 150);
NOTIFY pgrst,'reload schema';
