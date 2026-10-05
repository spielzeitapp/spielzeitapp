alter table public.match_videos
  add column if not exists scene_player_id uuid references public.players(id) on delete set null,
  add column if not exists assist_player_id uuid references public.players(id) on delete set null,
  add column if not exists linked_match_event_id uuid references public.match_events(id) on delete set null;

create or replace function public.annotate_match_video_scene(
  p_video_id uuid, p_chapter_id uuid, p_title text, p_kind text,
  p_player_id uuid, p_assist_player_id uuid, p_match_event_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.match_videos%rowtype;
  ev public.match_events%rowtype;
  next_chapters jsonb;
  squad_ids uuid[];
begin
  select * into v from public.match_videos where id = p_video_id for update;
  if not found or v.category = 'analysis' or not public.can_manage_match_video(v.match_id) then
    raise exception 'Keine Berechtigung für diese Szene' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 120
     or p_kind not in ('goal','shot','save','corner','defence','other')
     or (p_player_id is not null and p_player_id = p_assist_player_id) then
    raise exception 'Ungültige Szenenangaben';
  end if;
  select selected_player_ids into squad_ids from public.match_squad_publications where match_id = v.match_id;
  if p_player_id is not null and not exists (
    select 1 from public.players p where p.id = p_player_id and p.team_season_id = v.team_season_id
      and (squad_ids is null or p.id = any(squad_ids))
  ) then raise exception 'Spieler ist nicht im Matchkader'; end if;
  if p_assist_player_id is not null and not exists (
    select 1 from public.players p where p.id = p_assist_player_id and p.team_season_id = v.team_season_id
      and (squad_ids is null or p.id = any(squad_ids))
  ) then raise exception 'Vorlagengeber ist nicht im Matchkader'; end if;
  if p_assist_player_id is not null and p_kind <> 'goal' then
    raise exception 'Eine Vorlage kann nur einem Tor zugeordnet werden';
  end if;
  if p_match_event_id is not null then
    select * into ev from public.match_events where id = p_match_event_id;
    if not found or ev.match_id <> v.match_id or ev.type <> 'goal' or p_kind <> 'goal'
       or (ev.player_id is not null and ev.player_id is distinct from p_player_id) then
      raise exception 'Das Torereignis passt nicht zur Szene';
    end if;
  end if;
  if p_chapter_id is null then
    update public.match_videos
      set title = trim(p_title), scene_type = p_kind, scene_player_id = p_player_id,
          assist_player_id = p_assist_player_id, linked_match_event_id = p_match_event_id
      where id = v.id;
    return v.chapters;
  end if;
  if not exists (select 1 from jsonb_array_elements(v.chapters) c where c->>'id' = p_chapter_id::text) then
    raise exception 'Zeitmarke nicht gefunden';
  end if;
  select coalesce(jsonb_agg(case when c->>'id' = p_chapter_id::text then
      (c - 'player_id' - 'assist_player_id' - 'match_event_id') ||
      jsonb_build_object('title', trim(p_title), 'kind', p_kind,
        'player_id', p_player_id, 'assist_player_id', p_assist_player_id,
        'match_event_id', p_match_event_id)
    else c end order by ord), '[]'::jsonb)
  into next_chapters
  from jsonb_array_elements(v.chapters) with ordinality as a(c, ord);
  update public.match_videos set chapters = next_chapters where id = v.id;
  return next_chapters;
end;
$$;

revoke all on function public.annotate_match_video_scene(uuid,uuid,text,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.annotate_match_video_scene(uuid,uuid,text,text,uuid,uuid,uuid) to authenticated;
