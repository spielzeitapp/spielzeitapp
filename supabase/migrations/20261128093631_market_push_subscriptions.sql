create table public.market_push_subscriptions (
  endpoint text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null
);
alter table public.market_push_subscriptions enable row level security;
revoke all on public.market_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.market_push_subscriptions to service_role;
create index market_push_subscriptions_recipient_idx
  on public.market_push_subscriptions (user_id, club_id);
