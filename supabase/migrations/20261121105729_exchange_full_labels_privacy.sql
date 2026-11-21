-- Keep optional full labels removable on TEST as well as LIVE.
create function private.exchange_full_labels_privacy() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.raw_user_meta_data->'market_show_team' is distinct from new.raw_user_meta_data->'market_show_team' and new.raw_user_meta_data->'market_show_team' is distinct from 'true'::jsonb then
 update public.exchange_threads set requester_team_label='' where requester_id=new.id and requester_team_label<>'';
 update public.exchange_listings set team_label='' where owner_id=new.id and team_label<>'';
 end if;
 return new;
end;$$;
revoke all on function private.exchange_full_labels_privacy() from public,anon,authenticated;
create trigger exchange_full_labels_privacy after update of raw_user_meta_data on auth.users for each row execute function private.exchange_full_labels_privacy();
