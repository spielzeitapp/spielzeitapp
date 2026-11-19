-- Fixed team contributions, immutable payment snapshots and an append-only cash ledger.
-- These records document money received/paid outside the app; they never transfer money.
alter table public.exchange_listings add column team_fund_split jsonb not null default '[]';
alter table public.exchange_listings drop constraint exchange_listings_offer_check;
alter table public.exchange_listings add constraint exchange_listings_offer_check check(offer in ('Gratis','Tauschen','Verkaufen','Fürs Team'));
alter table public.exchange_listings add constraint exchange_listings_fund_price check(offer <> 'Fürs Team' or (price > 0 and price=round(price,2)));
grant update(team_fund_split) on public.exchange_listings to authenticated;

create table private.exchange_fund_settings(club_id uuid primary key references public.clubs(id), payment_note text not null check(length(trim(payment_note)) between 8 and 1000));
create table private.exchange_fund_access(club_id uuid not null references public.clubs(id), user_id uuid not null references auth.users(id) on delete cascade, team_id uuid not null references public.teams(id), can_book boolean not null default false, primary key(club_id,user_id,team_id));
create table private.exchange_fund_pledges(id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id), listing_id uuid references public.exchange_listings(id) on delete set null, buyer_id uuid references auth.users(id) on delete set null, owner_id uuid references auth.users(id) on delete set null, title text not null, amount_cents integer not null check(amount_cents between 1 and 999900), split jsonb not null, reference text not null unique, status text not null default 'pending' check(status in ('pending','confirmed','cancelled')), created_at timestamptz not null default now(), confirmed_at timestamptz);
create unique index exchange_fund_one_pledge on private.exchange_fund_pledges(listing_id) where status in ('pending','confirmed');
create table private.exchange_fund_entries(id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id), team_id uuid not null references public.teams(id), pledge_id uuid references private.exchange_fund_pledges(id), cents integer not null check(cents<>0), kind text not null check(kind in ('receipt','payout')), note text not null check(length(trim(note)) between 3 and 300), actor_id uuid references auth.users(id) on delete set null, request_id uuid not null, created_at timestamptz not null default now(), unique(club_id,request_id,team_id));
create unique index exchange_fund_receipt_once on private.exchange_fund_entries(pledge_id,team_id) where kind='receipt';
alter table private.exchange_fund_settings enable row level security;
alter table private.exchange_fund_access enable row level security;
alter table private.exchange_fund_pledges enable row level security;
alter table private.exchange_fund_entries enable row level security;
revoke all on private.exchange_fund_settings,private.exchange_fund_access,private.exchange_fund_pledges,private.exchange_fund_entries from public,anon,authenticated;
create index exchange_fund_access_user on private.exchange_fund_access(user_id,club_id);
create index exchange_fund_entries_team on private.exchange_fund_entries(club_id,team_id);
create index exchange_fund_pledges_club on private.exchange_fund_pledges(club_id,status);

create function private.exchange_fund_own_teams(c uuid) returns table(id uuid,label text) language sql stable security definer set search_path='' as $$
 select distinct t.id,private.exchange_parent_team_label(c,t.id) from public.teams t where auth.uid() is not null and private.exchange_member(c) and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_parent_team_allowed(c,t.id) and (
 exists(select 1 from private.exchange_member_teams m where m.club_id=c and m.user_id=auth.uid() and m.team_id=t.id)
 or exists(select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id where s.team_id=t.id and s.status='active' and m.user_id=auth.uid() and m.role::text in ('parent','trainer','co_trainer','head_coach','admin'))
 or exists(select 1 from public.player_guardians g join public.team_season_players p on p.player_id=g.player_id join public.team_seasons s on s.id=p.team_season_id where g.user_id=auth.uid() and s.status='active' and s.team_id=t.id and p.left_at is null and p.is_active));
$$;
create function private.exchange_fund_allowed(c uuid,t uuid,booking boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.club_is_operable(c) and not exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is not null) and (
 public.can_manage_club_venues(c) or exists(select 1 from private.exchange_fund_access a where a.club_id=c and a.user_id=auth.uid() and a.team_id=t and (not booking or a.can_book)) or (not booking and exists(select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id join public.teams x on x.id=s.team_id where m.user_id=auth.uid() and s.status='active' and s.team_id=t and m.role::text in ('trainer','co_trainer','head_coach') and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t)))));
$$;
create function private.exchange_fund_options(c uuid) returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label) order by label),'[]') from private.exchange_fund_own_teams(c); $$;

create function private.exchange_fund_listing_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare x jsonb; total bigint:=0; n integer:=0;
begin
 if tg_op='UPDATE' and new.offer=old.offer and new.price is not distinct from old.price and new.team_fund_split=old.team_fund_split then return new; end if;
 if tg_op='UPDATE' and exists(select 1 from private.exchange_fund_pledges p where p.listing_id=old.id and p.status in ('pending','confirmed')) then raise exception 'Für dieses Inserat besteht bereits ein Teambeitrag. Betrag und Aufteilung sind festgeschrieben.'; end if;
 if new.offer<>'Fürs Team' then if new.team_fund_split<>'[]'::jsonb then raise exception 'Teamaufteilung nur für Fürs Team möglich.'; end if;return new;end if;
 if jsonb_typeof(new.team_fund_split)<>'array' or jsonb_array_length(new.team_fund_split) not between 1 and 20 then raise exception 'Bitte mindestens ein eigenes Team auswählen.';end if;
 for x in select value from jsonb_array_elements(new.team_fund_split) loop
  if jsonb_typeof(x->'amount_cents')<>'number' or (x->>'amount_cents') !~ '^[0-9]+$' or (x->>'amount_cents')::bigint not between 1 and 999900 then raise exception 'Ungültiger Teilbetrag.';end if;
  if not exists(select 1 from private.exchange_fund_own_teams(new.club_id) t where t.id=(x->>'team_id')::uuid) or new.owner_id<>auth.uid() then raise exception 'Nur deine zugeordneten und freigegebenen Teams können ausgewählt werden.';end if;
  total:=total+(x->>'amount_cents')::bigint;n:=n+1;
 end loop;
 if (select count(distinct value->>'team_id') from jsonb_array_elements(new.team_fund_split))<>n or new.price is null or total<>new.price*100 then raise exception 'Die Teamaufteilung muss genau dem Gesamtbetrag entsprechen.';end if;
 return new;
end; $$;
create trigger exchange_fund_listing_guard before insert or update on public.exchange_listings for each row execute function private.exchange_fund_listing_guard();

create function private.exchange_fund_settings_save(c uuid,note text) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Nur der Vereinsadmin kann Zahlungsinformationen einstellen.';end if;
 insert into private.exchange_fund_settings values(c,trim(note)) on conflict(club_id) do update set payment_note=excluded.payment_note;
end; $$;
create function private.exchange_fund_grant(c uuid,u uuid,t uuid,access_mode text) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.can_manage_club_venues(c) then raise exception 'Keine Berechtigung.';end if;
 if not exists(select 1 from public.teams x where x.id=t and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t))) or not exists(select 1 from jsonb_array_elements(private.exchange_manager_candidates(c)) p where (p->>'id')::uuid=u) then raise exception 'Person oder Team gehört nicht zu diesem Verein.';end if;
 if access_mode='none' then delete from private.exchange_fund_access where club_id=c and user_id=u and team_id=t;
 elsif access_mode in ('read','book') then insert into private.exchange_fund_access values(c,u,t,access_mode='book') on conflict(club_id,user_id,team_id) do update set can_book=excluded.can_book;
 else raise exception 'Ungültige Berechtigung.';end if;
end; $$;
create function private.exchange_fund_detail(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.exchange_listings; p private.exchange_fund_pledges;
begin
 select * into r from public.exchange_listings where id=l;
 if not found or not private.exchange_member(r.club_id) or (r.status='Entwurf' and r.owner_id<>auth.uid()) then raise exception 'Inserat nicht verfügbar.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 return jsonb_build_object('payment_note',(select payment_note from private.exchange_fund_settings where club_id=r.club_id),'split',(select coalesce(jsonb_agg(jsonb_build_object('label',private.exchange_parent_team_label(r.club_id,(x->>'team_id')::uuid),'amount_cents',x->'amount_cents')),'[]') from jsonb_array_elements(r.team_fund_split) x),'pledge',case when p.buyer_id=auth.uid() or r.owner_id=auth.uid() then jsonb_build_object('id',p.id,'status',p.status,'reference',p.reference,'mine',p.buyer_id=auth.uid()) else null end,'taken',p.id is not null);
end; $$;
create function private.exchange_fund_pledge(l uuid,expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.exchange_listings; p private.exchange_fund_pledges;
begin
 select * into r from public.exchange_listings where id=l for update;
 if not found or not private.exchange_member(r.club_id) or r.owner_id=auth.uid() then raise exception 'Keine Berechtigung für diesen Teambeitrag.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 if found then if p.buyer_id=auth.uid() then return private.exchange_fund_detail(l);else raise exception 'Für dieses Inserat ist bereits ein Beitrag vorgemerkt.';end if;end if;
 if r.offer<>'Fürs Team' or r.status<>'Verfügbar' or r.revision<>expected then raise exception 'Inserat wurde geändert oder ist nicht mehr verfügbar. Bitte neu laden.';end if;
 if exists(select 1 from public.exchange_blocks where club_id=r.club_id and ((blocker_id=auth.uid() and blocked_id=r.owner_id) or (blocked_id=auth.uid() and blocker_id=r.owner_id))) then raise exception 'Anfrage nicht möglich.';end if;
 if not exists(select 1 from private.exchange_fund_settings where club_id=r.club_id) then raise exception 'Der Verein hat noch keine Zahlungsinformationen hinterlegt.';end if;
 insert into private.exchange_fund_pledges(club_id,listing_id,buyer_id,owner_id,title,amount_cents,split,reference) values(r.club_id,l,auth.uid(),r.owner_id,r.title,(r.price*100)::integer,r.team_fund_split,'VM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
 return private.exchange_fund_detail(l);
end; $$;
create function private.exchange_fund_cancel(p uuid) returns void language plpgsql security definer set search_path='' as $$ declare r private.exchange_fund_pledges;begin
 select * into r from private.exchange_fund_pledges where id=p for update;
 if not found or auth.uid() is null or not (r.buyer_id=auth.uid() or public.can_manage_club_venues(r.club_id)) then raise exception 'Keine Berechtigung.';end if;
 if r.status<>'pending' then raise exception 'Nur unbestätigte Beiträge können storniert werden.';end if;
 update private.exchange_fund_pledges set status='cancelled' where id=p;
end; $$;
create function private.exchange_fund_confirm(p uuid,note text) returns void language plpgsql security definer set search_path='' as $$
declare r private.exchange_fund_pledges;x jsonb;
begin
 select * into r from private.exchange_fund_pledges where id=p for update;
 if not found or auth.uid() is null then raise exception 'Beitrag nicht vorhanden.';end if;
 for x in select value from jsonb_array_elements(r.split) loop if not private.exchange_fund_allowed(r.club_id,(x->>'team_id')::uuid,true) then raise exception 'Buchungsrecht für alle beteiligten Teams erforderlich.';end if;end loop;
 if r.status='confirmed' then return;end if;
 if r.status<>'pending' then raise exception 'Beitrag ist storniert.';end if;
 perform 1 from public.clubs where id=r.club_id for update;
 for x in select value from jsonb_array_elements(r.split) loop
 insert into private.exchange_fund_entries(club_id,team_id,pledge_id,cents,kind,note,actor_id,request_id) values(r.club_id,(x->>'team_id')::uuid,r.id,(x->>'amount_cents')::integer,'receipt',trim(note),auth.uid(),r.id);
 end loop;
 update private.exchange_fund_pledges set status='confirmed',confirmed_at=now() where id=p;
end; $$;
create function private.exchange_fund_payout(c uuid,t uuid,amount integer,note text,request uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.exchange_fund_allowed(c,t,true) then raise exception 'Kein Buchungsrecht für dieses Team.';end if;
 perform 1 from public.clubs where id=c for update;
 if exists(select 1 from private.exchange_fund_entries where club_id=c and request_id=request and team_id=t) then return;end if;
 if amount is null or amount<=0 or amount>coalesce((select sum(cents) from private.exchange_fund_entries where club_id=c and team_id=t),0) then raise exception 'Betrag übersteigt das bestätigte Guthaben oder ist ungültig.';end if;
 insert into private.exchange_fund_entries(club_id,team_id,cents,kind,note,actor_id,request_id) values(c,t,-amount,'payout',trim(note),auth.uid(),request);
end; $$;
create function private.exchange_fund_dashboard(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare allowed uuid[]; admin boolean:=auth.uid() is not null and public.can_manage_club_venues(c);
begin
 select coalesce(array_agg(t.id),'{}') into allowed from public.teams t where (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_fund_allowed(c,t.id);
 if cardinality(allowed)=0 and not admin then raise exception 'Keine Teamkassa freigeschaltet.';end if;
 return jsonb_build_object('admin',admin,'payment_note',(select payment_note from private.exchange_fund_settings where club_id=c),'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',private.exchange_parent_team_label(c,t.id),'balance',coalesce((select sum(e.cents) from private.exchange_fund_entries e where e.club_id=c and e.team_id=t.id),0),'can_book',private.exchange_fund_allowed(c,t.id,true)) order by t.age_group,t.name),'[]') from public.teams t where t.id=any(allowed)),
 'pending',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'reference',p.reference,'amount_cents',p.amount_cents,'can_book',not exists(select 1 from jsonb_array_elements(p.split) x where not private.exchange_fund_allowed(c,(x->>'team_id')::uuid,true)),'created_at',p.created_at) order by p.created_at desc),'[]') from private.exchange_fund_pledges p where p.club_id=c and p.status='pending' and not exists(select 1 from jsonb_array_elements(p.split) x where not ((x->>'team_id')::uuid=any(allowed)))),
 'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select id,team_id,cents,kind,note,created_at,(select reference from private.exchange_fund_pledges p where p.id=pledge_id) as reference from private.exchange_fund_entries where club_id=c and team_id=any(allowed) order by created_at desc limit 200) e),
 'grants',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'team_id',a.team_id,'can_book',a.can_book)),'[]') from private.exchange_fund_access a where a.club_id=c) else '[]'::jsonb end);
end; $$;
create or replace function private.exchange_manager_clubs() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'market',private.exchange_can_manage(c.id,'market'),'teams',private.exchange_can_manage(c.id,'teams'),'admin',public.can_manage_club_venues(c.id),'cash',exists(select 1 from public.teams t where private.exchange_fund_allowed(c.id,t.id))) order by c.name),'[]') from public.clubs c where auth.uid() is not null and (private.exchange_can_manage(c.id,'market') or private.exchange_can_manage(c.id,'teams') or exists(select 1 from public.teams t where private.exchange_fund_allowed(c.id,t.id)));
$$;
-- Public RPC surface. Private tables remain inaccessible to clients.
create function public.exchange_fund_options(p_club_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.exchange_fund_options(p_club_id); $$;
revoke all on function public.exchange_fund_options(uuid) from public,anon;
grant execute on function public.exchange_fund_options(uuid) to authenticated;
revoke all on function private.exchange_fund_options(uuid) from public,anon;
grant execute on function private.exchange_fund_options(uuid) to authenticated;
create function public.exchange_fund_settings_save(p_club_id uuid,p_note text) returns void language sql security invoker set search_path='' as $$ select private.exchange_fund_settings_save(p_club_id,p_note); $$;
revoke all on function public.exchange_fund_settings_save(uuid,text) from public,anon;
grant execute on function public.exchange_fund_settings_save(uuid,text) to authenticated;
revoke all on function private.exchange_fund_settings_save(uuid,text) from public,anon;
grant execute on function private.exchange_fund_settings_save(uuid,text) to authenticated;
create function public.exchange_fund_grant(p_club_id uuid,p_user_id uuid,p_team_id uuid,p_mode text) returns void language sql security invoker set search_path='' as $$ select private.exchange_fund_grant(p_club_id,p_user_id,p_team_id,p_mode); $$;
revoke all on function public.exchange_fund_grant(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.exchange_fund_grant(uuid,uuid,uuid,text) to authenticated;
revoke all on function private.exchange_fund_grant(uuid,uuid,uuid,text) from public,anon;
grant execute on function private.exchange_fund_grant(uuid,uuid,uuid,text) to authenticated;
create function public.exchange_fund_detail(p_listing_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.exchange_fund_detail(p_listing_id); $$;
revoke all on function public.exchange_fund_detail(uuid) from public,anon;
grant execute on function public.exchange_fund_detail(uuid) to authenticated;
revoke all on function private.exchange_fund_detail(uuid) from public,anon;
grant execute on function private.exchange_fund_detail(uuid) to authenticated;
create function public.exchange_fund_pledge(p_listing_id uuid,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$ select private.exchange_fund_pledge(p_listing_id,p_expected); $$;
revoke all on function public.exchange_fund_pledge(uuid,integer) from public,anon;
grant execute on function public.exchange_fund_pledge(uuid,integer) to authenticated;
revoke all on function private.exchange_fund_pledge(uuid,integer) from public,anon;
grant execute on function private.exchange_fund_pledge(uuid,integer) to authenticated;
create function public.exchange_fund_cancel(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.exchange_fund_cancel(p_id); $$;
revoke all on function public.exchange_fund_cancel(uuid) from public,anon;
grant execute on function public.exchange_fund_cancel(uuid) to authenticated;
revoke all on function private.exchange_fund_cancel(uuid) from public,anon;
grant execute on function private.exchange_fund_cancel(uuid) to authenticated;
create function public.exchange_fund_confirm(p_id uuid,p_note text) returns void language sql security invoker set search_path='' as $$ select private.exchange_fund_confirm(p_id,p_note); $$;
revoke all on function public.exchange_fund_confirm(uuid,text) from public,anon;
grant execute on function public.exchange_fund_confirm(uuid,text) to authenticated;
revoke all on function private.exchange_fund_confirm(uuid,text) from public,anon;
grant execute on function private.exchange_fund_confirm(uuid,text) to authenticated;
create function public.exchange_fund_payout(p_club_id uuid,p_team_id uuid,p_amount integer,p_note text,p_request uuid) returns void language sql security invoker set search_path='' as $$ select private.exchange_fund_payout(p_club_id,p_team_id,p_amount,p_note,p_request); $$;
revoke all on function public.exchange_fund_payout(uuid,uuid,integer,text,uuid) from public,anon;
grant execute on function public.exchange_fund_payout(uuid,uuid,integer,text,uuid) to authenticated;
revoke all on function private.exchange_fund_payout(uuid,uuid,integer,text,uuid) from public,anon;
grant execute on function private.exchange_fund_payout(uuid,uuid,integer,text,uuid) to authenticated;
create function public.exchange_fund_dashboard(p_club_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.exchange_fund_dashboard(p_club_id); $$;
revoke all on function public.exchange_fund_dashboard(uuid) from public,anon;
grant execute on function public.exchange_fund_dashboard(uuid) to authenticated;
revoke all on function private.exchange_fund_dashboard(uuid) from public,anon;
grant execute on function private.exchange_fund_dashboard(uuid) to authenticated;
revoke all on function private.exchange_fund_listing_guard(),private.exchange_fund_own_teams(uuid),private.exchange_fund_allowed(uuid,uuid,boolean) from public,anon,authenticated;
