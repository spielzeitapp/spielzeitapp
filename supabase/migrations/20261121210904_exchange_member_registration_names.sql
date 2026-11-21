-- Match own-account identity fallback without exposing auth records or changing access.
do $patch$
declare d text;old_expression text:=$expr$coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(p.display_name,''),'Vereinsmitglied')$expr$;
begin
 select pg_get_functiondef('private.exchange_members_list(uuid)'::regprocedure) into d;
 if position(old_expression in d)=0 or position('from users u left join public.profiles p on p.id=u.user_id' in d)=0 then raise exception 'Unexpected member list implementation';end if;
 d:=replace(d,old_expression,$expr$left(coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',nullif(btrim(account.raw_user_meta_data->>'first_name'),''),nullif(btrim(account.raw_user_meta_data->>'last_name'),''))),''),nullif(btrim(account.raw_user_meta_data->>'full_name'),''),nullif(btrim(account.raw_user_meta_data->>'display_name'),''),nullif(btrim(account.raw_user_meta_data->>'name'),''),'Vereinsmitglied'),120)$expr$);
 d:=replace(d,'from users u left join public.profiles p on p.id=u.user_id','from users u left join auth.users account on account.id=u.user_id left join public.profiles p on p.id=u.user_id');
 execute d;
end $patch$;
