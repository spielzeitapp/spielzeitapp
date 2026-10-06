create schema if not exists private;
create or replace function private.enqueue_auto_feed_post_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team_id uuid; v_job_id uuid; v_title text;
begin
  if new.post_kind not in ('event_poster_auto','matchday_today_auto','matchday_tomorrow_auto')
     or new.event_id is null then return new; end if;
  select ts.team_id into v_team_id from public.team_seasons ts
    join public.events e on e.team_season_id=ts.id
    where ts.id=new.team_season_id and e.id=new.event_id;
  if v_team_id is null then return new; end if;
  v_title := 'Neuer Spieltag-Beitrag';
  insert into public.notification_jobs(event_id,team_id,kind,send_at,payload,status,dedupe_key)
    values(new.event_id,v_team_id,'event',now(),
      jsonb_build_object('automation','feed_post','feedPostId',new.id,
        'pushTitle',v_title,'pushBody',left(coalesce(new.caption,''),160),'linkPath','/app/home'),
      'pending','feed_post:' || new.id::text)
    on conflict(dedupe_key) do nothing returning id into v_job_id;
  if v_job_id is null then return new; end if;
  -- Feed markers are excluded from the message inbox, counted on Home, and
  -- acknowledged only when their associated post has been displayed.
  insert into public.notifications(team_id,user_id,event_id,title,message,link,type,event_type,kind,source_notification_job_id)
    select v_team_id,m.user_id,new.event_id,v_title,left(coalesce(new.caption,''),160),
      '/app/home','auto','feed_post',new.id::text,v_job_id
    from public.memberships m
    where m.team_season_id=new.team_season_id and m.role::text in ('parent','player','fan')
      and m.user_id is not null
    group by m.user_id
    on conflict(source_notification_job_id,user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_auto_feed_post_notification() from public,anon,authenticated;
drop trigger if exists enqueue_auto_feed_post_notification on public.team_feed_posts;
create trigger enqueue_auto_feed_post_notification after insert on public.team_feed_posts
  for each row execute function private.enqueue_auto_feed_post_notification();
