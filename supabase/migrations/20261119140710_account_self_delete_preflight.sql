-- Server-only preflight. It never deletes accounts or files.
create or replace function private.account_delete_plan(target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare dep record; blocked boolean; files jsonb;
begin
 if not exists(select 1 from auth.users where id=target) then raise exception 'Konto nicht gefunden.'; end if;
 -- Keep relational records intact when an account still owns orders/audits/setup responsibilities.
 for dep in select n.nspname schema_name,c.relname table_name,a.attname column_name from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1] where k.contype='f' and k.confrelid='auth.users'::regclass and k.confdeltype in ('a','r') and cardinality(k.conkey)=1 loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',dep.schema_name,dep.table_name,dep.column_name) into blocked using target;
  if blocked then return jsonb_build_object('blocked',true,'reason','Dein Konto ist noch mit Bestellungen oder Verwaltungsaufgaben verbunden. Bitte wende dich vor dem Löschen an die Vereinsverwaltung.'); end if;
 end loop;
 if exists(select 1 from storage.objects where (owner=target or owner_id=target::text) and bucket_id<>'exchange-photos') then
  return jsonb_build_object('blocked',true,'reason','Dein Konto verwaltet noch Dateien in SpielzeitApp. Bitte kläre die Übergabe mit der Vereinsverwaltung.');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name)),'[]'::jsonb) into files from storage.objects o where o.bucket_id='exchange-photos' and (o.owner=target or o.owner_id=target::text or exists(select 1 from public.exchange_listings l where l.owner_id=target and o.name=any(l.photo_paths) and split_part(o.name,'/',2)=target::text));
 return jsonb_build_object('blocked',false,'files',files);
end $$;
create or replace function public.account_delete_plan(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.account_delete_plan(p_user_id);$$;
revoke all on function private.account_delete_plan(uuid),public.account_delete_plan(uuid) from public,anon,authenticated;
grant execute on function private.account_delete_plan(uuid),public.account_delete_plan(uuid) to service_role;
