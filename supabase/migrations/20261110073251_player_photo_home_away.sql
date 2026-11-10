-- Existing purposes remain home kits; profile images are shared and unchanged.
alter table public.player_photo_motifs drop constraint player_photo_motifs_purpose_check;
alter table public.player_photo_motifs add constraint player_photo_motifs_purpose_check check (purpose in ('matchday','celebration','matchday_away','celebration_away'));
notify pgrst,'reload schema';
