-- Prepaid club shop: no demo products, bank details or users are seeded.
create table public.club_shop_settings (
 club_id uuid primary key references public.clubs(id),
 enabled boolean not null default false,
 recipient text not null default '' check(length(recipient)<=120),
 iban text not null default '' check(length(iban)<=34),
 dealer_id uuid references auth.users(id),
 manager_id uuid references auth.users(id)
);
create table public.club_shop_products (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 name text not null check(length(trim(name)) between 1 and 100),
 price_cents integer not null check(price_cents between 1 and 999999),
 sizes text[] not null check(cardinality(sizes) between 1 and 30),
 image_url text not null default '' check(image_url='' or image_url like 'https://%'),
 personalizable boolean not null default false, active boolean not null default true
);
create index club_shop_products_club on public.club_shop_products(club_id);
create table public.club_shop_rounds (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 title text not null check(length(trim(title)) between 1 and 100), deadline timestamptz not null,
 status text not null default 'open' check(status in ('open','released','confirmed','processing','ready','closed')),
 invoice_url text not null default '' check(invoice_url='' or invoice_url like 'https://%'),
 invoice_paid_at timestamptz, version integer not null default 0,
 recipient text not null default '', iban text not null default '', dealer_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index club_shop_rounds_club on public.club_shop_rounds(club_id,created_at desc);
create table public.club_shop_orders (
 id uuid primary key, club_id uuid not null references public.clubs(id), round_id uuid not null references public.club_shop_rounds(id),
 owner_id uuid not null references auth.users(id), owner_label text not null,
 items jsonb not null, total_cents integer not null check(total_cents>0),
 paid_at timestamptz, paid_by uuid references auth.users(id), submitted_at timestamptz,
 collected_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz not null default now()
);
create index club_shop_orders_round on public.club_shop_orders(round_id);
create index club_shop_orders_owner on public.club_shop_orders(owner_id,club_id);
create table public.club_shop_audit (
 id bigint generated always as identity primary key, club_id uuid not null references public.clubs(id),
 actor_id uuid not null references auth.users(id), action text not null, record_id uuid,
 created_at timestamptz not null default now()
);
alter table public.club_shop_settings enable row level security;
alter table public.club_shop_products enable row level security;
alter table public.club_shop_rounds enable row level security;
alter table public.club_shop_orders enable row level security;
alter table public.club_shop_audit enable row level security;
-- All access goes through a narrowly scoped private implementation. No direct
-- table grants: a buyer cannot forge a price, recipient, paid flag or release.
revoke all on public.club_shop_settings,public.club_shop_products,public.club_shop_rounds,public.club_shop_orders,public.club_shop_audit from anon,authenticated;
create function private.club_shop(p_club uuid, p_action text, p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.club_shop_settings; r public.club_shop_rounds; o public.club_shop_orders;
 p public.club_shop_products; staff boolean; dealer boolean; member boolean;
 rid uuid; oid uuid; entry jsonb; lines jsonb:='[]'; qty integer; total integer:=0;
 result jsonb; key_id uuid;
begin
 if u is null then raise exception 'Bitte anmelden'; end if;
 if not public.club_is_operable(p_club) then raise exception 'Verein nicht verfügbar'; end if;
 select * into s from public.club_shop_settings where club_id=p_club;
 staff:=public.can_manage_club_venues(p_club) or coalesce(s.manager_id=u,false);
 dealer:=coalesce(s.dealer_id=u,false);
 member:=public.exchange_access(p_club);
 if not(staff or dealer or member) then raise exception 'Kein Zugriff auf diesen Verein'; end if;
 if p_action='settings' then
  if not public.can_manage_club_venues(p_club) then raise exception 'Nur Vereinsadmin'; end if;
  if coalesce((p_data->>'enabled')::boolean,false) and (length(trim(p_data->>'recipient'))<2 or not (upper(replace(p_data->>'iban',' ','')) ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')) then raise exception 'Kontoinhaber und gültige IBAN erforderlich'; end if;
  if nullif(trim(p_data->>'dealer_email'),'') is not null and not exists(select 1 from public.profiles where lower(email)=lower(trim(p_data->>'dealer_email'))) then raise exception 'Händler benötigt zuerst ein SpielzeitApp-Konto'; end if;
  if nullif(trim(p_data->>'manager_email'),'') is not null and not exists(select 1 from public.profiles where lower(email)=lower(trim(p_data->>'manager_email'))) then raise exception 'Shopverantwortlicher benötigt zuerst ein SpielzeitApp-Konto'; end if;
  insert into public.club_shop_settings(club_id,enabled,recipient,iban,dealer_id,manager_id)
  values(p_club,coalesce((p_data->>'enabled')::boolean,false),trim(p_data->>'recipient'),upper(replace(p_data->>'iban',' ','')),(select id from public.profiles where lower(email)=lower(trim(p_data->>'dealer_email')) limit 1),(select id from public.profiles where lower(email)=lower(trim(p_data->>'manager_email')) limit 1))
  on conflict(club_id) do update set enabled=excluded.enabled,recipient=excluded.recipient,iban=excluded.iban,dealer_id=excluded.dealer_id,manager_id=excluded.manager_id;
 elsif p_action='product' then
  if not staff then raise exception 'Nur Shopverwaltung'; end if;
  insert into public.club_shop_products(id,club_id,name,price_cents,sizes,image_url,personalizable,active)
  values(coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()),p_club,trim(p_data->>'name'),(p_data->>'price_cents')::integer,array(select jsonb_array_elements_text(p_data->'sizes')),coalesce(p_data->>'image_url',''),coalesce((p_data->>'personalizable')::boolean,false),coalesce((p_data->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,price_cents=excluded.price_cents,sizes=excluded.sizes,image_url=excluded.image_url,personalizable=excluded.personalizable,active=excluded.active
  where club_shop_products.club_id=p_club;
 elsif p_action='round' then
  if not staff then raise exception 'Nur Shopverwaltung'; end if;
  if s.club_id is null or not s.enabled or s.dealer_id is null then raise exception 'Shop und Händler zuerst einrichten'; end if;
  if (p_data->>'deadline')::timestamptz<=now() then raise exception 'Bestellschluss muss in der Zukunft liegen'; end if;
  insert into public.club_shop_rounds(club_id,title,deadline,recipient,iban,dealer_id) values(p_club,trim(p_data->>'title'),(p_data->>'deadline')::timestamptz,s.recipient,s.iban,s.dealer_id);
 elsif p_action='order' then
  if not member or not coalesce(s.enabled,false) then raise exception 'Shop nicht freigeschaltet'; end if;
  oid:=(p_data->>'id')::uuid; rid:=(p_data->>'round_id')::uuid;
  select * into r from public.club_shop_rounds where id=rid and club_id=p_club for update;
  if r.id is null then raise exception 'Bestellrunde fehlt'; end if;
  select * into o from public.club_shop_orders where id=oid;
  if o.id is not null then
   if o.owner_id<>u or o.round_id<>rid then raise exception 'Ungültige Bestellnummer'; end if;
   return jsonb_build_object('order_id',o.id);
  end if;
  if r.status<>'open' or r.deadline<=now() then raise exception 'Bestellrunde geschlossen'; end if;
  if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 50 then raise exception 'Warenkorb ungültig'; end if;
  for entry in select * from jsonb_array_elements(p_data->'items') loop
   select * into p from public.club_shop_products where id=(entry->>'productId')::uuid and club_id=p_club and active;
   qty:=(entry->>'quantity')::integer;
   if p.id is null or not(coalesce(entry->>'size','')=any(p.sizes)) or qty is null or qty not between 1 and 99 then raise exception 'Artikel, Größe oder Menge ungültig'; end if;
   if length(coalesce(entry->>'name',''))>24 or coalesce(entry->>'number','')!~'^[0-9]{0,2}$' then raise exception 'Aufdruck ungültig'; end if;
   if not p.personalizable and (coalesce(entry->>'name','')<>'' or coalesce(entry->>'number','')<>'') then raise exception 'Aufdruck nicht verfügbar'; end if;
   total:=total+p.price_cents*qty;
   lines:=lines||jsonb_build_array(jsonb_build_object('productId',p.id,'title',p.name,'price_cents',p.price_cents,'size',entry->>'size','quantity',qty,'name',entry->>'name','number',entry->>'number'));
  end loop;
  if total is distinct from (p_data->>'expected_total')::integer then raise exception 'Preise wurden geändert. Bitte Warenkorb neu laden'; end if;
  insert into public.club_shop_orders(id,club_id,round_id,owner_id,owner_label,items,total_cents)
  values(oid,p_club,rid,u,coalesce((select coalesce(nullif(display_name,''),nullif(concat_ws(' ',first_name,last_name),''),'Vereinsmitglied') from public.profiles where id=u),'Vereinsmitglied'),lines,total);
  insert into public.club_shop_audit(club_id,actor_id,action,record_id) values(p_club,u,p_action,oid);
  return jsonb_build_object('order_id',oid);
 elsif p_action in ('paid','collect','cancel') then
  oid:=(p_data->>'id')::uuid;
  -- Same lock order as release: round first, then order. No pay/release race.
  select round_id into rid from public.club_shop_orders where id=oid and club_id=p_club;
  select * into r from public.club_shop_rounds where id=rid and club_id=p_club for update;
  select * into o from public.club_shop_orders where id=oid and club_id=p_club for update;
  if o.id is null then raise exception 'Bestellung fehlt'; end if;
  if p_action='paid' then
   if not staff then raise exception 'Nur Kassier oder Shopverwaltung'; end if;
   if o.cancelled_at is not null or r.status<>'open' then raise exception 'Bestellung nicht mehr offen'; end if;
   update public.club_shop_orders set paid_at=coalesce(paid_at,now()),paid_by=coalesce(paid_by,u) where id=oid;
  elsif p_action='collect' then
   if not staff or o.submitted_at is null or r.status not in ('ready','closed') then raise exception 'Noch nicht abholbereit'; end if;
   update public.club_shop_orders set collected_at=coalesce(collected_at,now()) where id=oid;
  else
   if o.owner_id<>u and not staff then raise exception 'Kein Zugriff'; end if;
   if o.paid_at is not null or r.status<>'open' then raise exception 'Bezahlte Bestellungen bitte mit dem Verein klären'; end if;
   update public.club_shop_orders set cancelled_at=coalesce(cancelled_at,now()) where id=oid;
  end if;
 elsif p_action in ('release','confirm','invoice','invoice_paid','processing','ready','close') then
  rid:=(p_data->>'id')::uuid;
  select * into r from public.club_shop_rounds where id=rid and club_id=p_club for update;
  if r.id is null or r.version is distinct from (p_data->>'version')::integer then raise exception 'Stand geändert. Bitte neu laden'; end if;
  if p_action in ('release','invoice_paid','close') then
   if not staff then raise exception 'Nur Shopverwaltung'; end if;
  elsif r.dealer_id<>u or r.dealer_id is null then raise exception 'Nur zugeordneter Händler'; end if;
  if p_action='release' then
   if r.status<>'open' or r.deadline>now() then raise exception 'Bestellschluss noch nicht erreicht'; end if;
   update public.club_shop_orders set submitted_at=now() where round_id=rid and paid_at is not null and cancelled_at is null and submitted_at is null;
   if not found then raise exception 'Keine bezahlten Bestellungen'; end if;
   update public.club_shop_rounds set status='released',version=version+1 where id=rid;
  elsif p_action='confirm' then
   if r.status<>'released' then raise exception 'Auftrag nicht zur Bestätigung bereit'; end if;
   update public.club_shop_rounds set status='confirmed',version=version+1 where id=rid;
  elsif p_action='invoice' then
   if r.status not in ('confirmed','processing','ready') then raise exception 'Auftrag zuerst bestätigen'; end if;
   if coalesce(p_data->>'url','')!~'^https://[^[:space:]]+$' then raise exception 'HTTPS-Rechnungslink erforderlich'; end if;
   update public.club_shop_rounds set invoice_url=p_data->>'url',version=version+1 where id=rid;
  elsif p_action='invoice_paid' then
   if r.invoice_url='' then raise exception 'Rechnung fehlt'; end if;
   update public.club_shop_rounds set invoice_paid_at=coalesce(invoice_paid_at,now()),version=version+1 where id=rid;
  elsif p_action='processing' then
   if r.status<>'confirmed' then raise exception 'Auftrag zuerst bestätigen'; end if;
   update public.club_shop_rounds set status='processing',version=version+1 where id=rid;
  elsif p_action='ready' then
   if r.status not in ('confirmed','processing') then raise exception 'Auftrag noch nicht bestätigt'; end if;
   update public.club_shop_rounds set status='ready',version=version+1 where id=rid;
  else
   if r.status<>'ready' or exists(select 1 from public.club_shop_orders where round_id=rid and submitted_at is not null and collected_at is null) then raise exception 'Zuerst alle Bestellungen ausgeben'; end if;
   update public.club_shop_rounds set status='closed',version=version+1 where id=rid;
  end if;
 elsif p_action<>'state' then raise exception 'Unbekannte Aktion';
 end if;
 if p_action<>'state' then insert into public.club_shop_audit(club_id,actor_id,action,record_id) values(p_club,u,p_action,coalesce(rid,oid)); end if;
 select * into s from public.club_shop_settings where club_id=p_club;
 select jsonb_build_object(
 'staff',staff,'admin',public.can_manage_club_venues(p_club),'dealer',dealer,
 'settings',case when staff then to_jsonb(s)||jsonb_build_object('dealer_email',(select email from public.profiles where id=s.dealer_id),'manager_email',(select email from public.profiles where id=s.manager_id)) else jsonb_build_object('enabled',coalesce(s.enabled,false)) end,
 'products',coalesce((select jsonb_agg(to_jsonb(x)) from public.club_shop_products x where x.club_id=p_club and (staff or x.active)),'[]'),
 'rounds',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.club_shop_rounds x where x.club_id=p_club and (staff or member or x.dealer_id=u)),'[]'),
 'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.club_shop_orders x where x.club_id=p_club and (staff or x.owner_id=u or (x.submitted_at is not null and exists(select 1 from public.club_shop_rounds z where z.id=x.round_id and z.dealer_id=u)))),'[]')
 ) into result;
 return result;
end; $$;
revoke all on function private.club_shop(uuid,text,jsonb) from public,anon;
grant execute on function private.club_shop(uuid,text,jsonb) to authenticated;
create function public.club_shop(p_club uuid,p_action text default 'state',p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.club_shop(p_club,p_action,p_data); $$;
revoke all on function public.club_shop(uuid,text,jsonb) from public,anon;
grant execute on function public.club_shop(uuid,text,jsonb) to authenticated;
