create function public.can_access_speaker_audio(p_club text) returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.teams t where t.club_id::text=p_club and public.club_is_operable(t.club_id)
 and (public.can_manage_club_venues(t.club_id) or exists (
 select 1 from public.team_seasons ts join public.memberships m on m.team_season_id=ts.id
 where ts.team_id=t.id and m.user_id=(select auth.uid()) and lower(m.role::text) in ('trainer','co_trainer','head_coach','head','admin')
 )));
$$;
revoke all on function public.can_access_speaker_audio(text) from public,anon;
grant execute on function public.can_access_speaker_audio(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('speaker-audio','speaker-audio',false,26214400,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/mp4','audio/x-m4a','audio/ogg','audio/aac','audio/flac','audio/x-flac','application/ogg','audio/webm']);
create policy speaker_audio_read on storage.objects for select to authenticated using(bucket_id='speaker-audio' and public.can_access_speaker_audio((storage.foldername(name))[1]));
create policy speaker_audio_insert on storage.objects for insert to authenticated with check(bucket_id='speaker-audio' and public.can_access_speaker_audio((storage.foldername(name))[1]) and storage.filename(name) like (select auth.uid())::text || '_%');
create policy speaker_audio_delete on storage.objects for delete to authenticated using(bucket_id='speaker-audio' and owner_id=(select auth.uid())::text and public.can_access_speaker_audio((storage.foldername(name))[1]));