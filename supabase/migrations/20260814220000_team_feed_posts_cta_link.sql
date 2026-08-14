-- LIVE-FEED.1: optionaler CTA-Link für manuelle Team-Feed-Posts (Staging zuerst).
-- Bestehende Posts: cta_url/cta_label bleiben NULL → keine UI-Änderung.

ALTER TABLE public.team_feed_posts
  ADD COLUMN IF NOT EXISTS cta_url text NULL,
  ADD COLUMN IF NOT EXISTS cta_label text NULL;

COMMENT ON COLUMN public.team_feed_posts.cta_url IS
  'Optionaler externer http(s)-Link (z. B. Cloudflare Stream Player). Kein Stream-Key.';
COMMENT ON COLUMN public.team_feed_posts.cta_label IS
  'Optionales Button-Label für cta_url (Plain Text, max. ~80 Zeichen).';
