-- Supabase default privileges can grant table-wide UPDATE/TRUNCATE. RLS alone
-- does not constrain TRUNCATE or immutable columns; reset defaults explicitly.
revoke all on public.exchange_partner_teams,public.exchange_listings,public.exchange_threads,
 public.exchange_messages,public.exchange_blocks,public.exchange_push_queue from public,anon,authenticated;
grant select,insert,delete on public.exchange_partner_teams,public.exchange_blocks to authenticated;
grant select,insert,delete on public.exchange_listings to authenticated;
grant update(title,category,size,condition,offer,price,description,team_label,status,photo_paths) on public.exchange_listings to authenticated;
grant select,insert on public.exchange_threads,public.exchange_messages to authenticated;
grant all on public.exchange_partner_teams,public.exchange_listings,public.exchange_threads,
 public.exchange_messages,public.exchange_blocks,public.exchange_push_queue to service_role;
