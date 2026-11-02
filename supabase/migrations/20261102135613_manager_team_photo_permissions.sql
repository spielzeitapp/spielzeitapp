-- Platform admins manage active/draft team-season photos without acquiring a trainer role.
CREATE POLICY team_photos_platform_admin_insert ON public.team_photos FOR INSERT TO authenticated
 WITH CHECK (public.is_platform_admin() AND EXISTS(SELECT 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=team_photos.team_season_id AND ts.status IN ('active','draft') AND c.status='active'));
CREATE POLICY team_photos_platform_admin_update ON public.team_photos FOR UPDATE TO authenticated
 USING (public.is_platform_admin())
 WITH CHECK (public.is_platform_admin() AND EXISTS(SELECT 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=team_photos.team_season_id AND ts.status IN ('active','draft') AND c.status='active'));
CREATE POLICY team_photos_platform_admin_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='team-photos' AND public.is_platform_admin() AND EXISTS(SELECT 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.id::text=split_part(storage.objects.name,'/',1) AND ts.status IN ('active','draft') AND c.status='active'));
CREATE POLICY team_photos_platform_admin_storage_select ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='team-photos' AND public.is_platform_admin());
