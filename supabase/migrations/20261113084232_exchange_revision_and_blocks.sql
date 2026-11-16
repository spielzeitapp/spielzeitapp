-- Optimistic concurrency: two devices must not overwrite newer edits silently.
-- Owners can clean up their own objects after deleting a listing.
alter policy exchange_photos_read on storage.objects using(
 bucket_id='exchange-photos' and ((storage.foldername(name))[2]=auth.uid()::text or exists(
 select 1 from public.exchange_listings l where l.club_id::text=(storage.foldername(name))[1]
 and l.owner_id::text=(storage.foldername(name))[2] and l.id::text=(storage.foldername(name))[3])));
alter table public.exchange_listings add column revision integer not null default 0;
create function private.exchange_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; return new; end; $$;
revoke all on function private.exchange_revision() from public,anon,authenticated;
create trigger exchange_revision before update on public.exchange_listings for each row execute function private.exchange_revision();

create table public.exchange_blocks (
 club_id uuid not null references public.clubs(id) on delete cascade,
 blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 primary key(club_id,blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
alter table public.exchange_blocks enable row level security;
grant select,insert,delete on public.exchange_blocks to authenticated;
create policy exchange_blocks_read on public.exchange_blocks for select to authenticated using(blocker_id=auth.uid());
create policy exchange_blocks_create on public.exchange_blocks for insert to authenticated with check(
 blocker_id=auth.uid() and private.exchange_member(club_id) and exists(
 select 1 from public.exchange_threads t join public.exchange_listings l on l.id=t.listing_id
 where l.club_id=exchange_blocks.club_id and
 ((l.owner_id=auth.uid() and t.requester_id=blocked_id) or (t.requester_id=auth.uid() and l.owner_id=blocked_id))));
create policy exchange_blocks_delete on public.exchange_blocks for delete to authenticated using(blocker_id=auth.uid());
create function private.exchange_pair_blocked(c uuid,u uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is null or exists(select 1 from public.exchange_blocks b where b.club_id=c
 and ((b.blocker_id=auth.uid() and b.blocked_id=u) or (b.blocker_id=u and b.blocked_id=auth.uid())));
$$;
revoke all on function private.exchange_pair_blocked(uuid,uuid) from public,anon;
grant execute on function private.exchange_pair_blocked(uuid,uuid) to authenticated;
alter policy exchange_threads_create on public.exchange_threads with check(
 requester_id=auth.uid() and exists(select 1 from public.exchange_listings l where l.id=listing_id
 and l.owner_id<>auth.uid() and l.status='Verfügbar' and not private.exchange_pair_blocked(l.club_id,l.owner_id)));
alter policy exchange_messages_create on public.exchange_messages with check(
 sender_id=auth.uid() and exists(select 1 from public.exchange_threads t join public.exchange_listings l on l.id=t.listing_id
 where t.id=thread_id and not private.exchange_pair_blocked(l.club_id,case when l.owner_id=auth.uid() then t.requester_id else l.owner_id end)));
