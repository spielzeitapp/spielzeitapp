-- Save scene metadata atomically; existing helpers enforce team permissions and squad membership.
create or replace function public.save_match_video_scene(
  p_video_id uuid, p_title text, p_category text, p_kind text,
  p_scene_minute integer, p_analysis_note text, p_player_id uuid,
  p_assist_player_id uuid, p_match_event_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v public.match_videos%rowtype;
  effective_minute integer := p_scene_minute;
begin
  select * into v from public.match_videos where id = p_video_id for update;
  if not found or not public.can_manage_match_video(v.match_id) then
    raise exception 'Keine Berechtigung für diese Szene' using errcode = '42501';
  end if;
  if p_category is null or p_kind is null or
     (p_scene_minute is not null and p_scene_minute not between 0 and 200) then
    raise exception 'Bitte eine Spielminute zwischen 0 und 200 eingeben';
  end if;
  if v.category = 'scenes' then
    if p_category <> 'scenes' then raise exception 'Ungültige Kategorie'; end if;
    perform public.update_match_analysis_scene(p_video_id,p_title,p_kind,p_scene_minute,p_analysis_note);
  else
    perform public.update_match_video_details(p_video_id,p_title,p_category);
  end if;
  if v.category <> 'analysis' then
    perform public.annotate_match_video_scene(p_video_id,null,p_title,p_kind,p_player_id,p_assist_player_id,p_match_event_id);
    if effective_minute is null and p_match_event_id is not null then
      select ceil(minute / 60.0)::integer into effective_minute
        from public.match_events where id = p_match_event_id;
    end if;
    if effective_minute is not null and effective_minute not between 0 and 200 then
      raise exception 'Bitte eine Spielminute zwischen 0 und 200 eingeben';
    end if;
    update public.match_videos set scene_minute = effective_minute where id = p_video_id;
  end if;
end;
$$;
revoke all on function public.save_match_video_scene(uuid,text,text,text,integer,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.save_match_video_scene(uuid,text,text,text,integer,text,uuid,uuid,uuid) to authenticated;
-- Only backfill minutes from valid linked goal events; retain manually entered minutes.
update public.match_videos v set scene_minute = ceil(e.minute / 60.0)::integer
from public.match_events e
where v.linked_match_event_id = e.id and e.match_id = v.match_id and e.type = 'goal'
  and v.scene_type = 'goal' and v.scene_minute is null
  and ceil(e.minute / 60.0) between 0 and 200;
