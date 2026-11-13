-- Canonical authenticated SpielzeitApp destination, for every club. Both app
-- surfaces share the same listings/threads; no copy and no client-chosen recipient.
create or replace function private.exchange_message_notify() returns trigger
 language plpgsql security definer set search_path='' as $$
declare recipient uuid; path text; club uuid;
begin
 select case when new.sender_id=l.owner_id then t.requester_id else l.owner_id end,l.club_id
 into recipient,club from public.exchange_threads t join public.exchange_listings l on l.id=t.listing_id where t.id=new.thread_id;
 path:='/app/tauschboerse?club='||club::text||'&thread='||new.thread_id::text;
 insert into public.notifications(user_id,title,message,link,type,event_type,kind)
 values(recipient,'Tauschbörse','Du hast eine neue Anfrage oder Nachricht zu einem Inserat.',path,'auto','exchange','exchange:'||new.thread_id::text);
 insert into public.exchange_push_queue(message_id,sender_id,recipient_id,link) values(new.id,new.sender_id,recipient,path);
 return new;
end; $$;
revoke all on function private.exchange_message_notify() from public,anon,authenticated;
