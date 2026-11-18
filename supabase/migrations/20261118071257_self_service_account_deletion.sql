-- Only the server, after password verification, may plan/finish account deletion.
create function private.market_delete_account(u uuid,finish boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; blocked boolean; mail text; files jsonb;
begin
 if u is null then raise exception 'Ungültiges Konto.'; end if;
 select email into mail from auth.users where id=u for update;
 if not found then return jsonb_build_object('deleted',true,'files','[]'::jsonb); end if;
 -- Keep shared club records and accountable administration intact until handover.
 if exists(select 1 from public.profiles where id=u and is_admin)
 or exists(select 1 from public.user_roles where user_id=u and role in ('admin','platform_admin','club_admin','trainer','head_coach','co_trainer'))
 or exists(select 1 from public.club_admin_assignments where user_id=u)
 or exists(select 1 from public.memberships where user_id=u and role::text in ('admin','trainer','head_coach','co_trainer')) then
  raise exception 'Für dieses Verwaltungskonto ist zuerst eine Übergabe nötig. Bitte kontaktiere Hilfe & Kontakt.' using errcode='P0001';
 end if;
 -- Do not silently erase or detach records with deliberate NO ACTION/RESTRICT FKs.
 for r in select n.nspname ns,c.relname tbl,a.attname col from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1]
  where k.contype='f' and k.confrelid='auth.users'::regclass and k.confdeltype in ('a','r') and n.nspname in ('public','private') loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',r.ns,r.tbl,r.col) into blocked using u;
  if blocked then raise exception 'Dieses Konto ist mit Verwaltungsunterlagen verknüpft. Bitte nutze Hilfe & Kontakt für die Löschung.' using errcode='P0001'; end if;
 end loop;
 if exists(select 1 from public.profiles where id=u and (nullif(avatar_url,'') is not null or nullif(cutout_url,'') is not null))
 or exists(select 1 from public.match_videos where created_by=u)
 or exists(select 1 from storage.objects where (owner=u or owner_id=u::text) and bucket_id<>'exchange-photos')
 or exists(select 1 from storage.buckets where owner=u or owner_id=u::text)
 or exists(select 1 from storage.s3_multipart_uploads where owner_id=u::text) then
  raise exception 'Dieses Konto hat weitere Dateien oder Vereinsbilder. Bitte nutze Hilfe & Kontakt, damit die Löschung vollständig geprüft wird.' using errcode='P0001';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]'::jsonb) into files from (
  select bucket_id,name from storage.objects where bucket_id='exchange-photos' and (owner=u or owner_id=u::text or split_part(name,'/',2)=u::text) order by name limit 200
 ) x;
 if not finish then return jsonb_build_object('deleted',false,'files',files); end if;
 if jsonb_array_length(files)>0 then raise exception 'Fotos sind noch nicht vollständig entfernt. Bitte erneut versuchen.'; end if;
 -- Explicitly erase personal rows without an auth-user foreign key.
 update public.events set created_by=null where created_by=u;
 update public.push_templates set created_by=null where created_by=u;
 delete from public.notifications where user_id=u;
 delete from public.push_subscriptions where user_id=u;
 delete from public.parent_link_invites where created_by_user_id=u or used_by_user_id=u or (mail is not null and lower(recipient_email)=lower(mail));
 delete from public.pending_team_staff_invites where mail is not null and lower(email)=lower(mail);
 -- Existing FKs cascade profiles, memberships, private messages, listings, votes,
 -- marketplace teams/terms, sessions and identities; shared club records remain.
 delete from auth.users where id=u;
 return jsonb_build_object('deleted',true,'files','[]'::jsonb);
end $$;
create function public.market_delete_account(p_user_id uuid,p_finish boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.market_delete_account(p_user_id,p_finish);$$;
revoke all on function private.market_delete_account(uuid,boolean),public.market_delete_account(uuid,boolean) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.market_delete_account(uuid,boolean),public.market_delete_account(uuid,boolean) to service_role;
notify pgrst,'reload schema';
