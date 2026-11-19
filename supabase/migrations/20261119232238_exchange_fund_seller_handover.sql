-- Seller receives the purchase price externally and announces their onward team contribution.
-- Existing buyer-origin pledges retain their meaning and confirmation history.
alter table private.exchange_fund_pledges add column initiated_by text not null default 'buyer' check(initiated_by in ('buyer','seller'));
create or replace function private.exchange_fund_detail(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.exchange_listings; p private.exchange_fund_pledges;
begin
 select * into r from public.exchange_listings where id=l;
 if not found or not private.exchange_member(r.club_id) or (r.status='Entwurf' and r.owner_id<>auth.uid()) then raise exception 'Inserat nicht verfügbar.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 return jsonb_build_object('payment_note',(select payment_note from private.exchange_fund_settings where club_id=r.club_id),'split',(select coalesce(jsonb_agg(jsonb_build_object('label',coalesce(private.exchange_parent_team_label(r.club_id,(x->>'team_id')::uuid),(select trim(concat_ws(' ',t.age_group,t.name)) from public.teams t where t.id=(x->>'team_id')::uuid),'Team'),'amount_cents',x->'amount_cents')),'[]') from jsonb_array_elements(r.team_fund_split) x),'pledge',case when p.buyer_id=auth.uid() or r.owner_id=auth.uid() then jsonb_build_object('id',p.id,'status',p.status,'reference',p.reference,'mine',case when p.initiated_by='seller' then r.owner_id=auth.uid() else p.buyer_id=auth.uid() end,'initiated_by',p.initiated_by) else null end,'taken',p.id is not null);
end; $$;

create or replace function private.exchange_fund_pledge(l uuid,expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.exchange_listings; p private.exchange_fund_pledges;
begin
 select * into r from public.exchange_listings where id=l for update;
 if not found or auth.uid() is null or r.owner_id is distinct from auth.uid() or not private.exchange_member(r.club_id) then raise exception 'Nur der Anbieter kann den Verkauf und Teambeitrag melden.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 if found then
  if p.initiated_by='seller' then return private.exchange_fund_detail(l);end if;
  raise exception 'Es besteht bereits eine frühere Käufer-Vormerkung. Bitte zuerst mit der Kassa klären.';
 end if;
 if r.offer<>'Fürs Team' or r.status not in ('Verfügbar','Reserviert','Vergeben') or r.revision<>expected then raise exception 'Inserat wurde geändert oder ist nicht mehr verfügbar. Bitte neu laden.';end if;
 if r.price is null or r.price<=0 or jsonb_array_length(r.team_fund_split)=0 then raise exception 'Teambeitrag und Aufteilung fehlen.';end if;
 update public.exchange_listings set status='Vergeben' where id=l;
 insert into private.exchange_fund_pledges(club_id,listing_id,owner_id,title,amount_cents,split,reference,initiated_by)
 values(r.club_id,l,r.owner_id,r.title,(r.price*100)::integer,r.team_fund_split,'VM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),'seller');
 return private.exchange_fund_detail(l);
end; $$;
create or replace function private.exchange_fund_cancel(p uuid) returns void language plpgsql security definer set search_path='' as $$
declare r private.exchange_fund_pledges;
begin
 select * into r from private.exchange_fund_pledges where id=p for update;
 if not found or auth.uid() is null or not (
 coalesce(case when r.initiated_by='seller' then r.owner_id=auth.uid() and private.exchange_member(r.club_id) else r.buyer_id=auth.uid() end,false)
 or public.can_manage_club_venues(r.club_id)) then raise exception 'Keine Berechtigung.';end if;
 if r.status<>'pending' then raise exception 'Nur unbestätigte Beiträge können storniert werden.';end if;
 update private.exchange_fund_pledges set status='cancelled' where id=p;
 -- Never silently republish a sold article; seller may explicitly change its status afterwards.
end; $$;
create function private.exchange_fund_sold_status_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>old.status and new.status<>'Vergeben' and exists(select 1 from private.exchange_fund_pledges p where p.listing_id=old.id and p.initiated_by='seller' and p.status in ('pending','confirmed')) then
 raise exception 'Der Verkauf ist gemeldet. Vor einer erneuten Freigabe zuerst die offene Meldung stornieren. Bestätigte Beiträge bleiben gebucht.';
 end if;
 return new;
end; $$;
revoke all on function private.exchange_fund_sold_status_guard() from public,anon,authenticated;
create trigger exchange_fund_sold_status_guard before update on public.exchange_listings for each row execute function private.exchange_fund_sold_status_guard();
create or replace function private.exchange_fund_dashboard(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare allowed uuid[]; admin boolean:=auth.uid() is not null and public.can_manage_club_venues(c);
begin
 select coalesce(array_agg(t.id),'{}') into allowed from public.teams t where (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_fund_allowed(c,t.id);
 if cardinality(allowed)=0 and not admin then raise exception 'Keine Teamkassa freigeschaltet.';end if;
 return jsonb_build_object('admin',admin,'payment_note',(select payment_note from private.exchange_fund_settings where club_id=c),'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',coalesce(private.exchange_parent_team_label(c,t.id),nullif(trim(concat_ws(' ',t.age_group,t.name)),''),'Team'),'balance',coalesce((select sum(e.cents) from private.exchange_fund_entries e where e.club_id=c and e.team_id=t.id),0),'can_book',private.exchange_fund_allowed(c,t.id,true)) order by t.age_group,t.name),'[]') from public.teams t where t.id=any(allowed)),
 'pending',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'reference',p.reference,'amount_cents',(select sum((x->>'amount_cents')::integer) from jsonb_array_elements(p.split) x where (x->>'team_id')::uuid=any(allowed)),
 'sender_label',coalesce((select l.owner_label from public.exchange_listings l where l.id=p.listing_id),'Anbieter'),
 'initiated_by',p.initiated_by,
 'split',(select jsonb_agg(jsonb_build_object('label',coalesce(private.exchange_parent_team_label(c,(x->>'team_id')::uuid),(select trim(concat_ws(' ',t.age_group,t.name)) from public.teams t where t.id=(x->>'team_id')::uuid),'Team'),'amount_cents',x->'amount_cents')) from jsonb_array_elements(p.split) x where (x->>'team_id')::uuid=any(allowed)),
 'team_ids',(select jsonb_agg(x->'team_id') from jsonb_array_elements(p.split) x where (x->>'team_id')::uuid=any(allowed)),'can_book',not exists(select 1 from jsonb_array_elements(p.split) x where not private.exchange_fund_allowed(c,(x->>'team_id')::uuid,true)),'created_at',p.created_at) order by p.created_at desc),'[]') from private.exchange_fund_pledges p where p.club_id=c and p.status='pending' and exists(select 1 from jsonb_array_elements(p.split) x where (x->>'team_id')::uuid=any(allowed))),
 'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select id,team_id,cents,kind,note,created_at,(select reference from private.exchange_fund_pledges p where p.id=pledge_id) as reference from private.exchange_fund_entries where club_id=c and team_id=any(allowed) order by created_at desc limit 200) e),
 'grants',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'team_id',a.team_id,'can_book',a.can_book)),'[]') from private.exchange_fund_access a where a.club_id=c) else '[]'::jsonb end);
end; $$;
