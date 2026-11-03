-- Keep existing automatic announcements consistent when an imported game moves.
create function oefb_sync.refresh_schedule_posts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.external_source is distinct from 'oefb' or new.starts_at is not distinct from old.starts_at
 or lower(coalesce(new.status,'')) in ('finished','ended','completed','cancelled','canceled','deleted') then return new; end if;
 update public.team_feed_posts p set
 payload=p.payload||jsonb_build_object('kickoff_iso',new.starts_at,'starts_at',new.starts_at,'match_id',new.match_id),
 caption=(case when p.post_kind='next_match_auto' then '⚽ NÄCHSTES SPIEL' else '⚽ SPIELTAG' end)||E'\n\n'||
 coalesce(nullif(p.payload->>'display_home_name',''),'Heim')||' – '||coalesce(nullif(p.payload->>'display_away_name',''),'Gast')||E'\n'||
 to_char(new.starts_at at time zone 'Europe/Vienna','DD.MM.YYYY · HH24:MI')||' Uhr'||E'\n'||coalesce(new.location,''),
 updated_at=now()
 where p.event_id=new.id and p.team_season_id=new.team_season_id
 and p.post_kind in ('next_match_auto','matchday_auto','matchday_today_auto','matchday_tomorrow_auto');
 return new;
end $$;
revoke all on function oefb_sync.refresh_schedule_posts() from public,anon,authenticated,service_role;
create trigger refresh_oefb_schedule_posts after update of starts_at on public.events
 for each row execute function oefb_sync.refresh_schedule_posts();
