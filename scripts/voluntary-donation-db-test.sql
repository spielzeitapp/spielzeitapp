do $$
declare c uuid:=gen_random_uuid();u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();adm uuid:=gen_random_uuid();t uuid:=gen_random_uuid();l uuid:=gen_random_uuid();l0 uuid:=gen_random_uuid();l2 uuid:=gen_random_uuid();rev integer;r jsonb;r2 jsonb;
begin
 insert into auth.users(id,email) values(u,u::text||'@example.invalid'),(v,v::text||'@example.invalid'),(adm,adm::text||'@example.invalid');
 insert into public.profiles(id,is_admin) values(u,false),(v,false),(adm,true) on conflict(id) do update set is_admin=excluded.is_admin;
 insert into public.clubs(id,name) values(c,'Voluntary donation rollback fixture');
 insert into public.teams(id,club_id,name,age_group,calendar_slug) values(t,c,'Fixture','U12',t::text);
 insert into private.exchange_members(club_id,user_id) values(c,u),(c,v);
 insert into private.exchange_member_teams(club_id,user_id,team_id) values(c,u,t);
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,status,photo_paths,voluntary_donation,donation_team_id)
 values(l,c,u,'Fixture Jacke','Jacke','152','Gut','Gratis','Verfügbar',array[c::text||'/'||u::text||'/'||l::text||'/photo.jpg'],true,t),
 (l2,c,u,'Fixture Verein positiv','Jacke','152','Gut','Gratis','Verfügbar',array[c::text||'/'||u::text||'/'||l2::text||'/photo.jpg'],true,null),
 (l0,c,u,'Fixture Verein','Jacke','152','Gut','Gratis','Verfügbar',array[c::text||'/'||u::text||'/'||l0::text||'/photo.jpg'],true,null);
 execute 'set local role authenticated';
 select revision into rev from public.exchange_listings where id=l;
 begin perform public.exchange_voluntary_manage(c,'report',l,rev+1,100);raise exception 'TEST stale accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform public.exchange_voluntary_manage(c,'report',l,rev,-1);raise exception 'TEST negative accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',v::text,true);
 begin perform public.exchange_voluntary_manage(c,'report',l,rev,100);raise exception 'TEST nonowner accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform public.exchange_voluntary_manage(c,'dashboard');raise exception 'TEST member dashboard accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.exchange_voluntary_manage(c,'report',l,rev,500);
 assert r->>'status'='pending';
 r2:=public.exchange_voluntary_manage(c,'report',l,rev,500);assert r->>'id'=r2->>'id';
 begin perform public.exchange_voluntary_manage(c,'report',l,rev,600);raise exception 'TEST changed amount accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform public.exchange_voluntary_manage(c,'confirm',p_id:=(r->>'id')::uuid,p_note:='Beleg 1');raise exception 'TEST owner booking accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 begin update public.exchange_listings set donation_team_id=null where id=l;raise exception 'TEST retarget accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform count(*) from private.exchange_voluntary_receipts;raise exception 'TEST raw access accepted';exception when insufficient_privilege then null;end;
 select revision into rev from public.exchange_listings where id=l0;
 r2:=public.exchange_voluntary_manage(c,'report',l0,rev,0);assert r2->>'status'='confirmed';
 select revision into rev from public.exchange_listings where id=l2;
 r2:=public.exchange_voluntary_manage(c,'report',l2,rev,200);assert r2->>'status'='pending';
 perform set_config('request.jwt.claim.sub',adm::text,true);
 r2:=public.exchange_voluntary_manage(c,'dashboard');assert jsonb_array_length(r2->'receipts')=2;
 begin perform public.exchange_voluntary_manage(c,'confirm',p_id:=(r->>'id')::uuid,p_note:='');raise exception 'TEST empty receipt accepted';exception when others then if sqlerrm like 'TEST%' then raise;end if;end;
 r2:=public.exchange_voluntary_manage(c,'confirm',p_id:=(r->>'id')::uuid,p_note:='Beleg 1');assert r2->>'status'='confirmed';
 r2:=public.exchange_voluntary_manage(c,'confirm',p_id:=(r->>'id')::uuid,p_note:='Beleg 1');assert r2->>'id'=r->>'id';
 execute 'reset role';
 assert (select count(*) from private.exchange_voluntary_receipts where club_id=c)=3;
 assert (select sum(amount_cents) from private.exchange_voluntary_receipts where club_id=c and status='confirmed')=500;
end;$$;
