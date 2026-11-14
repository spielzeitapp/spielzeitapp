-- No existing listing becomes public. Client table/storage grants stay private.
alter table public.exchange_listings add column is_public boolean not null default false;
alter table public.exchange_listings add column public_confirmed_at timestamptz;
grant update(is_public) on public.exchange_listings to authenticated;
create function private.exchange_public_confirmation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_public then
   if tg_op='INSERT' then new.public_confirmed_at:=now();
   elsif not old.is_public then new.public_confirmed_at:=now();
   else new.public_confirmed_at:=old.public_confirmed_at; end if;
 else new.public_confirmed_at:=null; end if;
 return new;
end; $$;
revoke all on function private.exchange_public_confirmation() from public,anon,authenticated;
create trigger exchange_public_confirmation before insert or update on public.exchange_listings for each row execute function private.exchange_public_confirmation();
