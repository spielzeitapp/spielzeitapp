-- Synthetic fixtures only. Run on TEST; all writes are rolled back.
begin;
insert into auth.users(id,email) select ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'shop-test-'||n||'@example.invalid' from generate_series(1,6) n;
insert into public.profiles(id,email,display_name,is_admin) select id,email,'Shop Test',id='91000000-0000-4000-8000-000000000001'::uuid from auth.users where id::text like '91000000-%' on conflict(id) do update set email=excluded.email,display_name=excluded.display_name,is_admin=excluded.is_admin;
insert into public.clubs(id,name,status) values('92000000-0000-4000-8000-000000000001','Isolated Shop Test','active'),('92000000-0000-4000-8000-000000000002','Other Isolated Shop Test','active');
insert into public.teams(id,club_id,name,calendar_slug) values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Synthetic','isolated-shop-test');
insert into public.team_seasons(id,team_id,status) values('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','active');
insert into public.memberships(user_id,team_season_id,role) values('91000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001','parent'),('91000000-0000-4000-8000-000000000006','94000000-0000-4000-8000-000000000001','parent');
create function pg_temp.deny(q text) returns void language plpgsql as $$begin begin execute q; exception when others then return; end; raise exception 'SECURITY CHECK FAILED: %',q;end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select public.club_shop('92000000-0000-4000-8000-000000000001','settings','{"enabled":true,"recipient":"Synthetic Club","iban":"AT611904300234573201","dealer_email":"shop-test-3@example.invalid","manager_email":"shop-test-5@example.invalid"}');
select public.club_shop('92000000-0000-4000-8000-000000000001','product','{"id":"95000000-0000-4000-8000-000000000001","name":"Synthetic Pulli","price_cents":3900,"sizes":["140","152"],"personalizable":true}');
select public.club_shop('92000000-0000-4000-8000-000000000001','round',jsonb_build_object('title','Synthetic round','deadline',now()+interval '1 day'));
reset role;
select set_config('shop.test_round',(select id::text from public.club_shop_rounds where club_id='92000000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000002')$q$);
select pg_temp.deny($q$select * from public.club_shop_orders$q$);
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001','product','{}')$q$);
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001','settings','{}')$q$);
-- Invalid size, quantity, changed price, and missing expected price.
do $$declare d jsonb:=jsonb_build_object('id','96000000-0000-4000-8000-000000000001','round_id',current_setting('shop.test_round'),'expected_total',3900,'items',jsonb_build_array(jsonb_build_object('productId','95000000-0000-4000-8000-000000000001','size','140','quantity',1,'name','Name','number','10')));begin
 perform pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','order',jsonb_set(d,'{items,0,size}','"999"')));
 perform pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','order',jsonb_set(d,'{items,0,quantity}','0')));
 perform pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','order',jsonb_set(d,'{expected_total}','1')));
 perform pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','order',d-'expected_total'));
 perform public.club_shop('92000000-0000-4000-8000-000000000001','order',d);
 perform public.club_shop('92000000-0000-4000-8000-000000000001','order',d); -- idempotent retry
 perform public.club_shop('92000000-0000-4000-8000-000000000001','order',jsonb_set(d,'{id}','"96000000-0000-4000-8000-000000000002"')); -- unpaid order left out
end$$;
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001','paid','{"id":"96000000-0000-4000-8000-000000000001"}')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000006',true);
do $$begin if jsonb_array_length(public.club_shop('92000000-0000-4000-8000-000000000001')->'orders')<>0 then raise exception 'Other buyer can see orders';end if;end$$;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
do $$begin if jsonb_array_length(public.club_shop('92000000-0000-4000-8000-000000000001')->'orders')<>0 then raise exception 'Dealer sees unsubmitted orders';end if;end$$;
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001','paid','{"id":"96000000-0000-4000-8000-000000000001"}')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000005',true);
select public.club_shop('92000000-0000-4000-8000-000000000001','paid','{"id":"96000000-0000-4000-8000-000000000001"}');
select public.club_shop('92000000-0000-4000-8000-000000000001','paid','{"id":"96000000-0000-4000-8000-000000000001"}');
-- Early release denied. Deadline is moved only in this rolled-back fixture.
select pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','release',jsonb_build_object('id',current_setting('shop.test_round'),'version',0)));
reset role;
update public.club_shop_rounds set deadline=now()-interval '1 minute' where id=current_setting('shop.test_round')::uuid;
set local role authenticated;
select public.club_shop('92000000-0000-4000-8000-000000000001','release',jsonb_build_object('id',current_setting('shop.test_round'),'version',0));
select pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','release',jsonb_build_object('id',current_setting('shop.test_round'),'version',0)));
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
do $$begin if jsonb_array_length(public.club_shop('92000000-0000-4000-8000-000000000001')->'orders')<>1 then raise exception 'Dealer should see exactly paid released order';end if;end$$;
select pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','confirm',jsonb_build_object('id',current_setting('shop.test_round'))));
select public.club_shop('92000000-0000-4000-8000-000000000001','confirm',jsonb_build_object('id',current_setting('shop.test_round'),'version',1));
select public.club_shop('92000000-0000-4000-8000-000000000001','invoice',jsonb_build_object('id',current_setting('shop.test_round'),'version',2,'url','https://example.invalid/invoice'));
select public.club_shop('92000000-0000-4000-8000-000000000001','processing',jsonb_build_object('id',current_setting('shop.test_round'),'version',3));
select public.club_shop('92000000-0000-4000-8000-000000000001','ready',jsonb_build_object('id',current_setting('shop.test_round'),'version',4));
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000005',true);
select public.club_shop('92000000-0000-4000-8000-000000000001','invoice_paid',jsonb_build_object('id',current_setting('shop.test_round'),'version',5));
select pg_temp.deny(format('select public.club_shop(%L,%L,%L::jsonb)','92000000-0000-4000-8000-000000000001','close',jsonb_build_object('id',current_setting('shop.test_round'),'version',6)));
select public.club_shop('92000000-0000-4000-8000-000000000001','collect','{"id":"96000000-0000-4000-8000-000000000001"}');
select public.club_shop('92000000-0000-4000-8000-000000000001','close',jsonb_build_object('id',current_setting('shop.test_round'),'version',6));
set local role anon;
select pg_temp.deny($q$select public.club_shop('92000000-0000-4000-8000-000000000001')$q$);
reset role;
do $$begin
 if (select count(*) from public.club_shop_orders where club_id='92000000-0000-4000-8000-000000000001')<>2 then raise exception 'Duplicate order created';end if;
 if (select count(*) from public.club_shop_orders where club_id='92000000-0000-4000-8000-000000000001' and submitted_at is not null)<>1 then raise exception 'Unpaid order was submitted';end if;
 if (select status from public.club_shop_rounds where id=current_setting('shop.test_round')::uuid)<>'closed' then raise exception 'End-to-end flow incomplete';end if;
end$$;
rollback;
select 'PASS: isolated prepaid shop workflow, role restrictions, invalid inputs, retries and stale versions; all fixtures rolled back' as result;
