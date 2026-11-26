alter table public.exchange_listings add column voluntary_donation boolean not null default false;
alter table public.exchange_listings add column donation_team_id uuid references public.teams(id);
alter table public.exchange_listings add constraint exchange_voluntary_free check(not voluntary_donation or (offer='Gratis' and price is null));
alter table public.exchange_listings add constraint exchange_voluntary_target check(voluntary_donation or donation_team_id is null);
grant update(voluntary_donation,donation_team_id) on public.exchange_listings to authenticated;
create table private.exchange_voluntary_receipts(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),listing_id uuid unique references public.exchange_listings(id) on delete set null,
 owner_id uuid references auth.users(id) on delete set null,title text not null,team_id uuid references public.teams(id),target_label text not null,
 amount_cents integer not null check(amount_cents between 0 and 999900),status text not null check(status in ('pending','confirmed')),note text not null default '',created_at timestamptz not null default now(),confirmed_at timestamptz,actor_id uuid references auth.users(id) on delete set null
);
alter table private.exchange_voluntary_receipts enable row level security;
revoke all on private.exchange_voluntary_receipts from public,anon,authenticated;
create function private.exchange_voluntary_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and exists(select 1 from private.exchange_voluntary_receipts r where r.listing_id=old.id) then
 if new.voluntary_donation is distinct from old.voluntary_donation or new.donation_team_id is distinct from old.donation_team_id or new.offer<>old.offer or new.status<>'Vergeben' then raise exception 'Dieser Abschluss ist bereits gemeldet. Bitte ein neues Inserat anlegen.';end if;
 end if;
 if new.voluntary_donation and new.donation_team_id is not null and (tg_op='INSERT' or new.donation_team_id is distinct from old.donation_team_id or new.voluntary_donation is distinct from old.voluntary_donation) and not exists(select 1 from private.exchange_fund_own_teams(new.club_id) t where t.id=new.donation_team_id) then raise exception 'Bitte ein eigenes freigegebenes Team auswählen.';end if;
 return new;
end;$$;
revoke all on function private.exchange_voluntary_guard() from public,anon,authenticated;
create trigger exchange_voluntary_guard before insert or update on public.exchange_listings for each row execute function private.exchange_voluntary_guard();
create function private.exchange_voluntary_manage(c uuid,a text,l uuid,expected integer,amount integer,n text,rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare listing public.exchange_listings;r private.exchange_voluntary_receipts; result jsonb;admin boolean:=false;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.';end if;
 admin:=public.club_is_operable(c) and public.can_manage_club_venues(c) and not exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is not null);
 if a='dashboard' then
 if not admin and not exists(select 1 from private.exchange_fund_access g where g.club_id=c and g.user_id=auth.uid() and private.exchange_fund_allowed(c,g.team_id)) then raise exception 'Keine Kassenfreigabe.';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from (select id,title,target_label,amount_cents,status,note,created_at,confirmed_at,case when team_id is null then admin else private.exchange_fund_allowed(c,team_id,true) end can_book from private.exchange_voluntary_receipts where club_id=c and amount_cents>0 and (admin or (team_id is not null and private.exchange_fund_allowed(c,team_id))) order by created_at desc limit 500) x;
 return jsonb_build_object('receipts',result);
 elsif a='confirm' then
 select * into r from private.exchange_voluntary_receipts where id=rid and club_id=c for update;
 if not found or not coalesce(case when r.team_id is null then admin else private.exchange_fund_allowed(c,r.team_id,true) end,false) then raise exception 'Keine Buchungsberechtigung.';end if;
 if r.status='confirmed' then return to_jsonb(r);end if;
 if length(trim(coalesce(n,''))) not between 3 and 300 then raise exception 'Bitte Beleg oder Eingangsnachweis angeben.';end if;
 update private.exchange_voluntary_receipts set status='confirmed',note=trim(n),confirmed_at=now(),actor_id=auth.uid() where id=r.id returning * into r;
 return to_jsonb(r);
 end if;
 select * into listing from public.exchange_listings where id=l and club_id=c for update;
 if not found or not private.exchange_member(c) or listing.owner_id is distinct from auth.uid() or not listing.voluntary_donation then raise exception 'Nur der Anbieter kann den tatsächlichen Eingang melden.';end if;
 select * into r from private.exchange_voluntary_receipts where listing_id=l;
 if a='detail' then return case when r.id is null then 'null'::jsonb else to_jsonb(r) end;end if;
 if a<>'report' then raise exception 'Unbekannte Aktion.';end if;
 if r.id is not null then
 if r.amount_cents is distinct from amount then raise exception 'Der bereits gemeldete Betrag bleibt erhalten.';end if;
 return to_jsonb(r);
 end if;
 if expected is null or listing.revision<>expected or listing.archived_at is not null or listing.status not in ('Verfügbar','Reserviert','Vergeben') then raise exception 'Inserat wurde geändert. Bitte neu laden.';end if;
 if amount is null or amount<0 or amount>999900 then raise exception 'Ungültiger Betrag.';end if;
 update public.exchange_listings set status='Vergeben' where id=l;
 insert into private.exchange_listing_outcomes(listing_id,club_id,outcome) values(l,c,'gifted') on conflict(listing_id) do nothing;
 insert into private.exchange_voluntary_receipts(club_id,listing_id,owner_id,title,team_id,target_label,amount_cents,status,confirmed_at)
 values(c,l,auth.uid(),listing.title,listing.donation_team_id,case when listing.donation_team_id is null then 'Gesamter Verein' else coalesce(private.exchange_parent_team_label(c,listing.donation_team_id),'Team') end,amount,case when amount=0 then 'confirmed' else 'pending' end,case when amount=0 then now() end) returning * into r;
 return to_jsonb(r);
end;$$;
revoke all on function private.exchange_voluntary_manage(uuid,text,uuid,integer,integer,text,uuid) from public,anon,authenticated;
create function public.exchange_voluntary_manage(p_club_id uuid,p_action text,p_listing_id uuid default null,p_expected integer default null,p_amount integer default null,p_note text default null,p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.exchange_voluntary_manage(p_club_id,p_action,p_listing_id,p_expected,p_amount,p_note,p_id);$$;
grant execute on function private.exchange_voluntary_manage(uuid,text,uuid,integer,integer,text,uuid) to authenticated;
revoke all on function public.exchange_voluntary_manage(uuid,text,uuid,integer,integer,text,uuid) from public,anon;
grant execute on function public.exchange_voluntary_manage(uuid,text,uuid,integer,integer,text,uuid) to authenticated;
