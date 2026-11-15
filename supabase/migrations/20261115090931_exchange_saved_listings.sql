-- Personal bookmark IDs only. This never grants access to listing content.
create function private.exchange_can_save(p_listing uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.exchange_listings l
 where l.id=p_listing and l.status in ('Verfügbar','Reserviert') and public.club_is_operable(l.club_id)
 and ((l.is_public and l.public_confirmed_at is not null) or private.exchange_member(l.club_id)));
$$;
revoke all on function private.exchange_can_save(uuid) from public,anon;
grant execute on function private.exchange_can_save(uuid) to authenticated;
create table public.exchange_saved_listings(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 listing_id uuid not null references public.exchange_listings(id) on delete cascade,
 created_at timestamptz not null default now(),unique(user_id,listing_id)
);
alter table public.exchange_saved_listings enable row level security;
revoke all on public.exchange_saved_listings from public,anon,authenticated;
grant select,delete on public.exchange_saved_listings to authenticated;
grant insert(user_id,listing_id) on public.exchange_saved_listings to authenticated;
grant all on public.exchange_saved_listings to service_role;
create policy exchange_saved_read on public.exchange_saved_listings for select to authenticated using(user_id=(select auth.uid()));
create policy exchange_saved_create on public.exchange_saved_listings for insert to authenticated with check(user_id=(select auth.uid()) and private.exchange_can_save(listing_id));
create policy exchange_saved_remove on public.exchange_saved_listings for delete to authenticated using(user_id=(select auth.uid()));
