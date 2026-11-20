-- Explicit owner-reported outcomes. No personal details are stored in the statistics.
alter table public.exchange_listings add column archived_at timestamptz, add column completion_outcome text check(completion_outcome in ('sold','gifted','swapped','team','withdrawn'));
create table private.exchange_listing_outcomes(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid unique references public.exchange_listings(id) on delete set null,
 club_id uuid not null references public.clubs(id),
 outcome text not null check(outcome in ('sold','gifted','swapped','team','withdrawn'))
);
alter table private.exchange_listing_outcomes enable row level security;
revoke all on private.exchange_listing_outcomes from public,anon,authenticated;
create index exchange_listing_outcomes_club on private.exchange_listing_outcomes(club_id,outcome);

create function private.exchange_completion_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and (new.archived_at is not null or new.completion_outcome is not null) then raise exception 'Abschluss nur über die Abschlussabfrage möglich.';end if;
 if tg_op='UPDATE' and old.archived_at is not null and new.status<>'Vergeben' then raise exception 'Archivierte Inserate können nicht erneut veröffentlicht werden. Bitte ein neues Inserat anlegen.';end if;
 return new;
end;$$;
revoke all on function private.exchange_completion_guard() from public,anon,authenticated;
create trigger exchange_completion_guard before insert or update on public.exchange_listings for each row execute function private.exchange_completion_guard();

create function private.exchange_listing_finish(l uuid,expected integer,result text,disposition text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.exchange_listings; recorded text; wanted text; p private.exchange_fund_pledges; paths text[];
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.';end if;
 if disposition is null or disposition not in ('archive','delete') or result is null or result not in ('sold','gifted','swapped','team','withdrawn') then raise exception 'Bitte Abschluss und Aktion auswählen.';end if;
 select * into r from public.exchange_listings where id=l for update;
 -- Repeated permanent removal never adds another outcome or another pledge.
 if not found then return jsonb_build_object('removed',true,'photo_paths','[]'::jsonb);end if;
 if r.owner_id is distinct from auth.uid() or not private.exchange_member(r.club_id) then raise exception 'Nur der Anbieter kann dieses Inserat abschließen.';end if;
 if r.revision<>expected then raise exception 'Inserat wurde geändert. Bitte neu laden.';end if;
 wanted:=case r.offer when 'Verkaufen' then 'sold' when 'Gratis' then 'gifted' when 'Tauschen' then 'swapped' when 'Fürs Team' then 'team' end;
 if result<>wanted and result<>'withdrawn' then raise exception 'Dieser Abschluss passt nicht zum Inserat.';end if;
 if r.status='Entwurf' and result<>'withdrawn' then raise exception 'Ein Entwurf kann nur ohne Abschluss entfernt werden.';end if;
 select outcome into recorded from private.exchange_listing_outcomes where listing_id=l;
 if recorded is not null and recorded<>result then raise exception 'Der bereits gemeldete Abschluss bleibt für die Statistik erhalten.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 if p.id is not null and result<>'team' then raise exception 'Für dieses Inserat besteht ein Teambeitrag. Bitte den bestehenden Abschluss übernehmen.';end if;
 if result='team' and p.id is null then
  perform private.exchange_fund_pledge(l,expected);
 end if;
 insert into private.exchange_listing_outcomes(listing_id,club_id,outcome) values(l,r.club_id,result) on conflict(listing_id) do nothing;
 paths:=r.photo_paths;
 if disposition='delete' then
  delete from public.exchange_listings where id=l;
 else
  update public.exchange_listings set status='Vergeben', archived_at=coalesce(archived_at,now()),completion_outcome=result where id=l;
 end if;
 return jsonb_build_object('removed',disposition='delete','photo_paths',case when disposition='delete' then to_jsonb(paths) else '[]'::jsonb end,'outcome',result);
end;$$;
revoke all on function private.exchange_listing_finish(uuid,integer,text,text) from public,anon;
grant execute on function private.exchange_listing_finish(uuid,integer,text,text) to authenticated;
create function public.exchange_listing_finish(p_listing_id uuid,p_expected integer,p_outcome text,p_disposition text) returns jsonb language sql security invoker set search_path='' as $$select private.exchange_listing_finish(p_listing_id,p_expected,p_outcome,p_disposition);$$;
revoke all on function public.exchange_listing_finish(uuid,integer,text,text) from public,anon;
grant execute on function public.exchange_listing_finish(uuid,integer,text,text) to authenticated;

create function private.exchange_listing_statistics(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.exchange_can_manage(c,'market') then raise exception 'Keine Berechtigung für die Vereinsmarkt-Statistik.';end if;
 return (select jsonb_build_object('sold',count(*) filter(where outcome='sold'),'gifted',count(*) filter(where outcome='gifted'),'swapped',count(*) filter(where outcome='swapped')) from private.exchange_listing_outcomes where club_id=c);
 -- Team sale announcements are not donations received. Confirmed receipts remain in the scoped cash ledger.
end;$$;
revoke all on function private.exchange_listing_statistics(uuid) from public,anon;
grant execute on function private.exchange_listing_statistics(uuid) to authenticated;
create function public.exchange_listing_statistics(p_club_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.exchange_listing_statistics(p_club_id);$$;
revoke all on function public.exchange_listing_statistics(uuid) from public,anon;
grant execute on function public.exchange_listing_statistics(uuid) to authenticated;
