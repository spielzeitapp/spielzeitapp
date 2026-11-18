-- Preserve earlier receipts; new registrations record the text actually accepted.
alter table private.market_terms_acceptances drop constraint market_terms_acceptances_terms_version_check;
alter table private.market_terms_acceptances add constraint market_terms_acceptances_terms_version_check check(terms_version in ('2026-11-17','2026-11-18'));
create or replace function private.market_registration_choices() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'auth_entry'='vereinsmarkt' and new.raw_user_meta_data->>'market_terms_version' in ('2026-11-17','2026-11-18') then
  insert into private.market_terms_acceptances(user_id,terms_version) values(new.id,new.raw_user_meta_data->>'market_terms_version') on conflict do nothing;
 end if;
 if tg_op='UPDATE' and new.raw_user_meta_data->'market_show_team'='false'::jsonb and old.raw_user_meta_data->'market_show_team' is distinct from 'false'::jsonb then
  update public.exchange_threads set requester_team_label='' where requester_id=new.id and requester_team_label<>'';
  update public.exchange_listings set team_label='' where owner_id=new.id and team_label<>'';
 end if;
 return new;
end $$;
revoke all on function private.market_registration_choices() from public,anon,authenticated;
notify pgrst,'reload schema';
