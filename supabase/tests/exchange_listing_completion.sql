begin;
do $setup$
declare c uuid:=(select id from public.clubs where name ilike '%gölsen%' or name ilike '%rohrbach%' limit 1);a uuid:=(select user_id from public.user_roles where role::text='admin' limit 1);s uuid:=gen_random_uuid();b uuid:=gen_random_uuid();m uuid:=gen_random_uuid();t uuid:=gen_random_uuid();t2 uuid:=gen_random_uuid();l uuid:=gen_random_uuid();r jsonb;v integer;
begin
 if c is null or a is null then raise exception 'Test fixture needs a club and platform admin';end if;
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values(s,s::text||'@fund-test.invalid','{}','{}',now(),now()),(b,b::text||'@fund-test.invalid','{}','{}',now(),now()),(m,m::text||'@fund-test.invalid','{}','{}',now(),now());
 insert into private.exchange_members(club_id,user_id) values(c,s),(c,b),(c,m);
 insert into public.teams(id,club_id,name,age_group) values(t,c,'FundTest U12 '||t::text,'U12'),(t2,c,'FundTest U13 '||t2::text,'U13');
 insert into private.exchange_member_teams(club_id,user_id,team_id) values(c,s,t),(c,s,t2);
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 r:=public.exchange_parent_teams_admin(c);v:=(r->>'version')::int;
 perform public.exchange_parent_teams_admin(c,jsonb_build_array(jsonb_build_object('id',t,'label','U12 Fund'),jsonb_build_object('id',t2,'label','U13 Fund')),v);
 perform public.exchange_manager_assign(c,m,true,false);
 perform set_config('test.fund_c',c::text,true);perform set_config('test.fund_a',a::text,true);perform set_config('test.fund_s',s::text,true);perform set_config('test.fund_b',b::text,true);perform set_config('test.fund_m',m::text,true);perform set_config('test.fund_t',t::text,true);perform set_config('test.fund_t2',t2::text,true);perform set_config('test.fund_l',l::text,true);
end $setup$;
set local role authenticated;
do $completion$
declare c uuid:=current_setting('test.fund_c')::uuid;a uuid:=current_setting('test.fund_a')::uuid;s uuid:=current_setting('test.fund_s')::uuid;b uuid:=current_setting('test.fund_b')::uuid;t uuid:=current_setting('test.fund_t')::uuid;l uuid;l2 uuid;p uuid;r jsonb;rev integer;denied boolean;off text;outcome text;before_stats jsonb;after_stats jsonb;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);before_stats:=public.exchange_listing_statistics(c);
 for off,outcome in select * from (values('Verkaufen','sold'),('Gratis','gifted'),('Tauschen','swapped')) v(o,x) loop
  l:=gen_random_uuid();perform set_config('request.jwt.claim.sub',s::text,true);
  insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,price,status,photo_paths) values(l,c,s,'Completion synthetic','Pulli','128','Gut',off,10,'Verfügbar',array[c::text||'/'||s::text||'/'||l::text||'/test.jpg']);
  perform set_config('request.jwt.claim.sub',b::text,true);
  denied:=false;begin perform public.exchange_listing_finish(l,0,outcome,'delete');exception when others then denied:=true;end;if not denied then raise exception 'Other user deleted listing';end if;
  denied:=false;begin perform public.exchange_listing_statistics(c);exception when others then denied:=true;end;if not denied then raise exception 'Member read manager statistics';end if;
  perform set_config('request.jwt.claim.sub',s::text,true);
  denied:=false;begin perform public.exchange_listing_finish(l,0,'team','archive');exception when others then denied:=true;end;if not denied then raise exception 'Incompatible result accepted';end if;
  denied:=false;begin perform public.exchange_listing_finish(l,null,outcome,'archive');exception when others then denied:=true;end;if not denied then raise exception 'Null revision accepted';end if;
  denied:=false;begin perform public.exchange_listing_finish(l,9,outcome,'archive');exception when others then denied:=true;end;if not denied then raise exception 'Stale archive accepted';end if;
  r:=public.exchange_listing_finish(l,0,outcome,'archive');
  if not exists(select 1 from public.exchange_listings where id=l and archived_at is not null and completion_outcome=outcome and status='Vergeben') then raise exception 'Archive missing';end if;
  select revision into rev from public.exchange_listings where id=l;
  denied:=false;begin update public.exchange_listings set status='Verfügbar' where id=l;exception when others then denied:=true;end;if not denied then raise exception 'Archived listing republished';end if;
  denied:=false;begin perform public.exchange_listing_finish(l,rev,'withdrawn','delete');exception when others then denied:=true;end;if not denied then raise exception 'Recorded result changed';end if;
  r:=public.exchange_listing_finish(l,rev,outcome,'delete');
  if exists(select 1 from public.exchange_listings where id=l) or jsonb_array_length(r->'photo_paths')<>1 then raise exception 'Delete/photo cleanup list failed';end if;
  perform public.exchange_listing_finish(l,rev,outcome,'delete');
 end loop;
 perform set_config('request.jwt.claim.sub',a::text,true);after_stats:=public.exchange_listing_statistics(c);
 if (after_stats->>'sold')::int<>(before_stats->>'sold')::int+1 or (after_stats->>'gifted')::int<>(before_stats->>'gifted')::int+1 or (after_stats->>'swapped')::int<>(before_stats->>'swapped')::int+1 then raise exception 'Anonymous stats lost or doubled after deletion';end if;
 perform set_config('request.jwt.claim.sub',s::text,true);l:=gen_random_uuid();
 insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,status) values(l,c,s,'Draft synthetic','Pulli','128','Gut','Gratis','Entwurf');
 denied:=false;begin perform public.exchange_listing_finish(l,0,'gifted','archive');exception when others then denied:=true;end;if not denied then raise exception 'Draft counted as success';end if;
 perform public.exchange_listing_finish(l,0,'withdrawn','delete');
 l:=gen_random_uuid();
 insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,price,team_fund_split,status,photo_paths) values(l,c,s,'Team completion synthetic','Pulli','128','Gut','Fürs Team',5,jsonb_build_array(jsonb_build_object('team_id',t,'amount_cents',500)),'Verfügbar',array[c::text||'/'||s::text||'/'||l::text||'/team.jpg']);
 r:=public.exchange_fund_pledge(l,0);p:=(r->'pledge'->>'id')::uuid;select revision into rev from public.exchange_listings where id=l;
 perform public.exchange_listing_finish(l,rev,'team','delete');
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.exchange_fund_dashboard(c);
 if not exists(select 1 from jsonb_array_elements(r->'pending') x where x->>'id'=p::text) then raise exception 'Open fund pledge lost on delete';end if;
 perform public.exchange_fund_confirm(p,'Received after listing deletion');perform public.exchange_fund_confirm(p,'Duplicate receipt');
 if not exists(select 1 from jsonb_array_elements(public.exchange_fund_dashboard(c)->'teams') x where x->>'id'=t::text and (x->>'balance')::integer=500) then raise exception 'Preserved pledge not confirmable after delete';end if;
 -- New team sale and archive must be atomic, with one pending pledge and no cash booking.
 perform set_config('request.jwt.claim.sub',s::text,true);l2:=gen_random_uuid();
 insert into public.exchange_listings(id,club_id,owner_id,title,category,size,condition,offer,price,team_fund_split,status,photo_paths) values(l2,c,s,'Team archive synthetic','Pulli','128','Gut','Fürs Team',5,jsonb_build_array(jsonb_build_object('team_id',t,'amount_cents',500)),'Verfügbar',array[c::text||'/'||s::text||'/'||l2::text||'/team.jpg']);
 perform public.exchange_listing_finish(l2,0,'team','archive');r:=public.exchange_fund_detail(l2);
 if r->'pledge'->>'status'<>'pending' then raise exception 'Team archive did not create pending pledge';end if;
 if has_function_privilege('anon','public.exchange_listing_finish(uuid,integer,text,text)','execute') then raise exception 'Anonymous finish exposed';end if;
 denied:=false;begin perform 1 from private.exchange_listing_outcomes;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Private outcome records exposed';end if;
end $completion$;
reset role;
select 'PASS actual authenticated role: ownership, stale revision, offer compatibility, draft withdrawal, archive/delete, anonymous counts retained/deduplicated, team pledge retained and confirmable after delete, atomic team archive, no anonymous/private access' result;
rollback;
