-- TEST regression fixture; all writes are rolled back.
begin;
do $test$
declare sid uuid:='9428a319-b613-4cfc-adce-480aa096b691'; eid uuid:='0b2c4a03-c7f7-4503-ba83-eb24783d46a5'; mid uuid:='4190a0fe-8edc-4fc7-bcb3-bfc3de78a9c6'; n integer; actor uuid;
 games jsonb:='[{"id":"4134573","kickoff":"2026-11-02T15:30:00.000Z","score":"1:0","status":"Live"}]';
begin
 delete from oefb_sync.tasks;
 assert not has_schema_privilege('anon','oefb_sync','USAGE');
 assert not has_schema_privilege('authenticated','oefb_sync','USAGE');
 assert not has_function_privilege('authenticated','oefb_sync.tick()','EXECUTE');
 assert not has_function_privilege('anon','oefb_sync.reconcile(uuid,text,jsonb)','EXECUTE');
 update public.team_seasons set oefb_auto_sync_enabled=true where id=sid;
 update public.events set starts_at='2026-10-17T16:00Z',status='upcoming' where id=eid;
 update public.matches set match_date='2026-10-17T16:00Z',status='upcoming',score_home=0,score_away=0 where id=mid;
 n:=oefb_sync.reconcile(sid,'232775',games);
 assert (select status='upcoming' and score_home=0 from public.matches where id=mid),'Live score finalized';
 assert (select payload->>'kickoff_iso'='2026-11-02T15:30:00+00:00' and caption like '%02.11.2026 · 16:30%' from public.team_feed_posts where event_id=eid and post_kind='next_match_auto'),'Announcement not rescheduled';
 games:=replace(games::text,'Live','Endstand')::jsonb;
 n:=oefb_sync.reconcile(sid,'232775',games);
 assert (select status='finished' and score_home=1 and score_away=0 from public.matches where id=mid);
 assert (select count(*)=1 from public.team_feed_posts where dedupe_key='result_feed:'||mid);
 assert (select payload->>'starts_at'='2026-11-02T15:30:00+00:00' from public.team_feed_posts where dedupe_key='result_feed:'||mid);
 n:=oefb_sync.reconcile(sid,'232775',games); assert n=0,'Repeated sync changed event';
 assert (select count(*)=1 from public.team_feed_posts where dedupe_key='result_feed:'||mid),'Duplicate feed post';
 n:=oefb_sync.reconcile(sid,'232775',replace(games::text,'1:0','9:0')::jsonb);
 assert (select score_home=1 from public.matches where id=mid),'Conflicting final score overwritten';
 update public.matches set status='upcoming',live_started_at=now() where id=mid;
 n:=oefb_sync.reconcile(sid,'232775',replace(games::text,'11-02','11-01')::jsonb); assert n=0,'Native clock not protected';
 update public.matches set status='finished',live_started_at=null where id=mid;
 -- A source result without a linked native match records its origin, with no invented human actor.
 update public.events set match_id=null,status='upcoming' where id=eid;
 n:=oefb_sync.reconcile(sid,'232775',games);
 assert (select rc.confirmed_by is null and rc.confirmation_source='oefb' from public.events e join h2h_private.result_confirmations rc on rc.match_id=e.match_id where e.id=eid);
 -- Public staff RPC must still reject unauthorized callers.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 begin perform public.sync_oefb_competition_fixtures(sid,'232775','[]'); raise exception 'Outsider allowed'; exception when insufficient_privilege then null; end;
 select id into actor from public.profiles where is_admin=true limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.sync_oefb_competition_fixtures(sid,'wrong','[]'); raise exception 'Wrong competition allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 -- Exercise the trusted HTTP consumer without network access.
 insert into oefb_sync.tasks(competition_id,round_id) values('232775',0);
 perform oefb_sync.consume('232775',0,200,jsonb_build_object('round',0,'rounds',jsonb_build_array(jsonb_build_object('id',7)),
 'games',jsonb_build_array(jsonb_build_object('sourceUrl','https://www.oefb.at/bewerbe/Spiel/Spielbericht/4134573/','kickoff','2026-11-02T15:30:00.000Z','score','1:0','status','Endstand')))::text);
 assert (select last_success is not null and last_error is null from oefb_sync.tasks where competition_id='232775' and round_id=0),'Valid HTTP response not consumed';
 assert exists(select 1 from oefb_sync.tasks where competition_id='232775' and round_id=7),'Historical round not discovered';
 perform oefb_sync.consume('232775',0,502,'upstream failure');
 assert (select last_error is not null and next_at>now() from oefb_sync.tasks where competition_id='232775' and round_id=0),'Failure not retained for retry';
 assert (select status='finished' and starts_at='2026-11-02T15:30Z' from public.events where id=eid),'Failed fetch erased result';
 -- Explicit opt-in, stale saves, incorrect age-group reuse, and assignment changes.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.set_oefb_auto_sync(sid,true,'wrong'); raise exception 'Stale save allowed'; exception when raise_exception then if sqlerrm='Stale save allowed' then raise; end if; end;
 begin perform public.set_oefb_auto_sync('5dd421cd-b47f-4889-8867-9bc1fa451c09',true,'232775'); raise exception 'Cross-age reuse allowed'; exception when raise_exception then if sqlerrm='Cross-age reuse allowed' then raise; end if; end;
 perform public.set_oefb_auto_sync(sid,false,'232775');
 assert (select not oefb_auto_sync_enabled from public.team_seasons where id=sid),'Disable failed';
 perform public.set_oefb_auto_sync(sid,true,'232775');
 update public.team_seasons set oefb_table_competition_id='232776' where id=sid;
 assert (select not oefb_auto_sync_enabled from public.team_seasons where id=sid),'Assignment change did not disable sync';
end $test$;
rollback;
select 'PASS: automatic sync, live/final distinction, feed dedupe, safeguards, authorization, historical rounds, retry and season controls' as checks;
