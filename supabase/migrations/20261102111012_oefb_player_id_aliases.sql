-- The club roster page and official reports expose different ÖFB IDs for the
-- same person. Keep both confirmed aliases; each source ID still identifies
-- exactly one player within its season through the existing primary key.
ALTER TABLE public.oefb_player_links
 DROP CONSTRAINT oefb_player_links_team_season_id_player_id_key;
CREATE INDEX oefb_player_links_season_player_idx
 ON public.oefb_player_links(team_season_id, player_id);
