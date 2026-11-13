-- Vereinsinterne Tauschbörse. No club IDs, user records or TEST branding in schema.
create schema if not exists private;

-- Explicit partner teams, e.g. a youth Spielgemeinschaft. Only club admins can configure.
create table public.exchange_partner_teams (
 club_id uuid not null references public.clubs(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 primary key(club_id,team_id)
);
alter table public.exchange_partner_teams enable row level security;
grant select,insert,delete on public.exchange_partner_teams to authenticated;
create policy exchange_partners_read on public.exchange_partner_teams for select to authenticated using (true);
create policy exchange_partners_write on public.exchange_partner_teams for insert to authenticated with check(public.can_manage_club_venues(club_id));
create policy exchange_partners_delete on public.exchange_partner_teams for delete to authenticated using(public.can_manage_club_venues(club_id));

-- This narrowly scoped lookup must see the caller's own membership irrespective of
-- team RLS. Never trusts user_metadata, a client-supplied owner, or a favourite.
create function private.exchange_member(c uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.club_is_operable(c) and (
 public.can_manage_club_venues(c) or exists(
 select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id
 join public.teams t on t.id=s.team_id where m.user_id=auth.uid() and s.status='active'
 and m.role::text in ('parent','trainer','co_trainer','head_coach','admin','fan')
 and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id))));
$$;
revoke all on function private.exchange_member(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.exchange_member(uuid) to authenticated;
create function public.exchange_access(p_club_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select private.exchange_member(p_club_id);
$$;
revoke all on function public.exchange_access(uuid) from public,anon;
grant execute on function public.exchange_access(uuid) to authenticated;

create table public.exchange_listings (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 80),
 category text not null check(category in ('T-Shirt','Hose','Pulli','Trainingsanzug','Jacke','Schuhe','Sonstiges')),
 size text not null check(length(trim(size)) between 1 and 15),
 condition text not null check(condition in ('Wie neu','Sehr gut','Gut','Gebraucht')),
 offer text not null check(offer in ('Gratis','Tauschen','Verkaufen')),
 price numeric(8,2) check(price>=0 and price<=9999),
 description text not null default '' check(length(description)<=1500),
 team_label text not null default '' check(length(team_label)<=50),
 owner_label text not null default '' check(length(owner_label)<=50),
 status text not null default 'Verfügbar' check(status in ('Entwurf','Verfügbar','Reserviert','Vergeben')),
 photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=5),
 created_at timestamptz not null default now(),
 check(offer <> 'Verkaufen' or price is not null)
);
create index exchange_listings_club_date on public.exchange_listings(club_id,created_at desc);
create index exchange_listings_owner on public.exchange_listings(owner_id);
alter table public.exchange_listings enable row level security;
grant select,insert,delete on public.exchange_listings to authenticated;
grant update(title,category,size,condition,offer,price,description,team_label,status,photo_paths) on public.exchange_listings to authenticated;
create policy exchange_listings_read on public.exchange_listings for select to authenticated
 using(private.exchange_member(club_id) and (status<>'Entwurf' or owner_id=auth.uid()));
create policy exchange_listings_create on public.exchange_listings for insert to authenticated
 with check(owner_id=auth.uid() and private.exchange_member(club_id));
create policy exchange_listings_update on public.exchange_listings for update to authenticated
 using(owner_id=auth.uid() and private.exchange_member(club_id))
 with check(owner_id=auth.uid() and private.exchange_member(club_id));
create policy exchange_listings_delete on public.exchange_listings for delete to authenticated
 using(owner_id=auth.uid() and private.exchange_member(club_id));

-- Name derives from the profile; only the first name is published, no profile join
-- exposing phone/email. Paths must belong to this listing and its owner.
create function private.exchange_listing_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
 select left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.display_name),' ',1),''),'Vereinsmitglied'),50)
 into new.owner_label from public.profiles p where p.id=new.owner_id;
 new.owner_label:=coalesce(new.owner_label,'Vereinsmitglied');
 end if;
 if exists(select 1 from unnest(new.photo_paths) p where p not like new.club_id::text||'/'||new.owner_id::text||'/'||new.id::text||'/%') then
 raise exception 'Ungültiger Fotopfad'; end if;
 if new.status<>'Entwurf' and cardinality(new.photo_paths)=0 then raise exception 'Bitte mindestens ein Foto hinzufügen'; end if;
 return new;
end; $$;
revoke all on function private.exchange_listing_guard() from public,anon,authenticated;
create trigger exchange_listing_guard before insert or update on public.exchange_listings for each row execute function private.exchange_listing_guard();

create table public.exchange_threads (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.exchange_listings(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 requester_label text not null default 'Vereinsmitglied',
 created_at timestamptz not null default now(),
 unique(listing_id,requester_id)
);
create index exchange_threads_requester on public.exchange_threads(requester_id);
alter table public.exchange_threads enable row level security;
grant select,insert on public.exchange_threads to authenticated;
create policy exchange_threads_read on public.exchange_threads for select to authenticated using(
 exists(select 1 from public.exchange_listings l where l.id=listing_id and (l.owner_id=auth.uid() or requester_id=auth.uid())));
create policy exchange_threads_create on public.exchange_threads for insert to authenticated with check(
 requester_id=auth.uid() and exists(select 1 from public.exchange_listings l where l.id=listing_id and l.owner_id<>auth.uid() and l.status='Verfügbar'));
create function private.exchange_requester_label() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.display_name),' ',1),''),'Vereinsmitglied'),50)
 into new.requester_label from public.profiles p where p.id=new.requester_id;
 new.requester_label:=coalesce(new.requester_label,'Vereinsmitglied'); return new;
end; $$;
revoke all on function private.exchange_requester_label() from public,anon,authenticated;
create trigger exchange_requester_label before insert on public.exchange_threads for each row execute function private.exchange_requester_label();

create table public.exchange_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.exchange_threads(id) on delete cascade,
 sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index exchange_messages_thread_date on public.exchange_messages(thread_id,created_at);
alter table public.exchange_messages enable row level security;
grant select,insert on public.exchange_messages to authenticated;
create policy exchange_messages_read on public.exchange_messages for select to authenticated using(exists(select 1 from public.exchange_threads t where t.id=thread_id));
create policy exchange_messages_create on public.exchange_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.exchange_threads t where t.id=thread_id));

-- Durable, private delivery queue. Content of chats never appears on lock screens.
create table public.exchange_push_queue (
 message_id uuid primary key references public.exchange_messages(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 link text not null,
 status text not null default 'pending' check(status in ('pending','processing','sent')),
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 attempts integer not null default 0
);
alter table public.exchange_push_queue enable row level security;
revoke all on public.exchange_push_queue from public,anon,authenticated;
grant all on public.exchange_push_queue to service_role;
create index exchange_push_pending on public.exchange_push_queue(status,created_at);
create function private.exchange_message_notify() returns trigger
 language plpgsql security definer set search_path='' as $$
declare recipient uuid; path text;
begin
 select case when new.sender_id=l.owner_id then t.requester_id else l.owner_id end into recipient
 from public.exchange_threads t join public.exchange_listings l on l.id=t.listing_id where t.id=new.thread_id;
 path:='/app/usc-rohrbach?tab=verein&section=tauschboerse&thread='||new.thread_id::text;
 insert into public.notifications(user_id,title,message,link,type,event_type,kind)
 values(recipient,'Tauschbörse','Du hast eine neue Anfrage oder Nachricht zu einem Inserat.',path,'auto','exchange','exchange:'||new.thread_id::text);
 insert into public.exchange_push_queue(message_id,sender_id,recipient_id,link) values(new.id,new.sender_id,recipient,path);
 return new;
end; $$;
revoke all on function private.exchange_message_notify() from public,anon,authenticated;
create trigger exchange_message_notify after insert on public.exchange_messages for each row execute function private.exchange_message_notify();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('exchange-photos','exchange-photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Listing existence binds every object to the correct club/user/listing. UUIDs are
-- compared as strings so malformed paths never cause a cast error.
create policy exchange_photos_read on storage.objects for select to authenticated using(
 bucket_id='exchange-photos' and exists(select 1 from public.exchange_listings l
 where l.club_id::text=(storage.foldername(name))[1] and l.owner_id::text=(storage.foldername(name))[2]
 and l.id::text=(storage.foldername(name))[3]));
create policy exchange_photos_create on storage.objects for insert to authenticated with check(
 bucket_id='exchange-photos' and exists(select 1 from public.exchange_listings l
 where l.owner_id=auth.uid() and l.club_id::text=(storage.foldername(name))[1]
 and l.owner_id::text=(storage.foldername(name))[2] and l.id::text=(storage.foldername(name))[3]));
create policy exchange_photos_delete on storage.objects for delete to authenticated using(
 bucket_id='exchange-photos' and (storage.foldername(name))[2]=auth.uid()::text);
