create table public.tournament_squad_publications (
  event_id uuid primary key references public.events(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  selected_player_ids uuid[] not null,
  version integer not null check (version > 0),
  published_at timestamptz not null default now()
);
alter table public.tournament_squad_publications enable row level security;
revoke all on public.tournament_squad_publications from public, anon, authenticated;
grant select on public.tournament_squad_publications to authenticated;
create policy tournament_squad_publications_staff on public.tournament_squad_publications
  for select to authenticated using (
    public.is_platform_admin() or public.membership_is_staff_for_team_season(team_season_id)
  );

create schema if not exists private;

-- Draft saves and confirmations serialize on the same event.
create function private.lock_tournament_squad_event(p_event uuid) returns public.events
language plpgsql set search_path = '' as $$
declare
  target public.events%rowtype;
begin
  select e.* into target from public.events e
    join public.team_seasons ts on ts.id = e.team_season_id
    where e.id = p_event and e.kind = 'tournament'
      and e.tournament_completed_at is null and coalesce(e.status, 'upcoming') in ('upcoming', 'live')
      and ts.status in ('active', 'draft')
      and auth.uid() is not null
      and (public.is_platform_admin() or public.membership_is_staff_for_team_season(e.team_season_id))
    for update of e;
  if not found then
    raise exception 'Turnier ist nicht bearbeitbar.' using errcode = '42501';
  end if;
  return target;
end;
$$;

create function private.tournament_active_roster(p_season uuid) returns setof uuid
language sql stable set search_path = '' as $$
  select sp.player_id from public.team_season_players sp
    where sp.team_season_id = p_season and coalesce(sp.is_active, true)
  union
  select p.id from public.players p
    where p.team_season_id = p_season and coalesce(p.is_active, true)
      and not exists (select 1 from public.team_season_players sp
        where sp.team_season_id = p_season and sp.player_id = p.id);
$$;

create function private.tournament_draft_ids(p_event uuid) returns uuid[]
language sql stable set search_path = '' as $$
  select array(select s.player_id from public.tournament_squad s
    where s.tournament_event_id = p_event order by s.player_id);
$$;

revoke all on function private.lock_tournament_squad_event(uuid),
  private.tournament_active_roster(uuid), private.tournament_draft_ids(uuid)
  from public, anon, authenticated;

create function public.save_tournament_squad_draft(p_event uuid, p_players uuid[], p_expected uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.events%rowtype;
  current_ids uuid[];
  selected uuid[];
begin
  target := private.lock_tournament_squad_event(p_event);
  current_ids := private.tournament_draft_ids(p_event);
  if p_players is null or cardinality(p_players) > 200 or array_position(p_players, null) is not null then
    raise exception 'Ungültiger Turnierkader.';
  end if;
  selected := array(select distinct id from unnest(p_players) as p(id) order by id);
  if selected = current_ids then return; end if;
  if p_expected is null or current_ids <> array(select id from unnest(p_expected) as p(id) order by id) then
    raise exception 'Der Turnierkader wurde inzwischen geändert. Bitte neu öffnen.';
  end if;
  if exists (select id from unnest(selected) as p(id)
    except select private.tournament_active_roster(target.team_season_id)) then
    raise exception 'Der Turnierkader enthält Spieler außerhalb des aktiven Saisonkaders.';
  end if;

  delete from public.tournament_squad
    where tournament_event_id = p_event and not (player_id = any(selected));
  insert into public.tournament_squad(tournament_event_id, player_id)
    select p_event, id from unnest(selected) as p(id)
    on conflict (tournament_event_id, player_id) do nothing;
end;
$$;

create function public.publish_tournament_squad(
  p_event uuid, p_expected uuid[], p_version integer,
  p_selected_message text, p_not_selected_message text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.events%rowtype;
  previous public.tournament_squad_publications%rowtype;
  publication public.tournament_squad_publications%rowtype;
  selected uuid[];
  tournament_name text;
  team_id uuid;
  player_names jsonb;
  link text := '/app/events/' || p_event::text;
  headline text;
begin
  target := private.lock_tournament_squad_event(p_event);
  selected := private.tournament_draft_ids(p_event);
  if cardinality(selected) = 0 then
    raise exception 'Bitte zuerst mindestens einen Spieler in den Kader aufnehmen.';
  end if;
  if p_expected is null or selected <> array(select id from unnest(p_expected) as p(id) order by id) then
    raise exception 'Der Turnierkader wurde inzwischen geändert. Bitte neu öffnen und prüfen.';
  end if;
  if exists (select id from unnest(selected) as p(id)
    except select private.tournament_active_roster(target.team_season_id)) then
    raise exception 'Der Turnierkader enthält Spieler außerhalb des aktiven Saisonkaders.';
  end if;
  select * into previous from public.tournament_squad_publications where event_id = p_event;
  if previous.selected_player_ids = selected then
    return to_jsonb(previous);
  end if;
  if p_version is distinct from coalesce(previous.version, 0) then
    raise exception 'Der Turnierkader wurde inzwischen veröffentlicht. Bitte neu öffnen.';
  end if;
  if coalesce(length(btrim(p_selected_message)), 0) not between 1 and 500
    or coalesce(length(btrim(p_not_selected_message)), 0) not between 1 and 500 then
    raise exception 'Bitte beide Nachrichten mit maximal 500 Zeichen ausfüllen.';
  end if;

  select ts.team_id into team_id from public.team_seasons ts where ts.id = target.team_season_id;
  tournament_name := left(coalesce(nullif(btrim((regexp_split_to_array(btrim(target.notes), E'\\r?\\n| · '))[1]), ''),
    nullif(btrim(target.opponent), ''), 'Turnier'), 120);
  headline := case when previous.version is null then 'Turnierkader veröffentlicht' else 'Turnierkader aktualisiert' end;
  select jsonb_agg(coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Spieler')
    order by p.last_name, p.first_name, p.id) into player_names
    from public.players p where p.id = any(selected);

  insert into public.tournament_squad_publications(event_id, team_season_id, selected_player_ids, version)
    values (p_event, target.team_season_id, selected, coalesce(previous.version, 0) + 1)
    on conflict (event_id) do update set
      team_season_id = excluded.team_season_id, selected_player_ids = excluded.selected_player_ids,
      version = excluded.version, published_at = now()
    returning * into publication;

  insert into public.team_feed_posts(team_season_id, team_id, event_id, post_kind, caption, payload, dedupe_key, created_by)
    values (target.team_season_id, team_id, p_event, 'tournament_squad_published', tournament_name,
      jsonb_build_object('title', headline, 'players', player_names, 'version', publication.version),
      'tournament-squad-feed:' || p_event::text, auth.uid())
    on conflict (dedupe_key) do update set
      caption = excluded.caption, payload = excluded.payload, updated_at = now(), created_by = excluded.created_by;

  -- A guardian linked to several players gets one message, with selection taking precedence.
  with roster as (select private.tournament_active_roster(target.team_season_id) as player_id),
  linked as (
    select g.user_id, r.player_id from roster r join public.player_guardians g using (player_id)
    union
    select u.user_id, r.player_id from roster r join public.player_users u using (player_id)
  ), audience as (
    select user_id, bool_or(player_id = any(selected)) as nominated
    from linked where user_id is not null group by user_id
  ), queued as (
    insert into public.notification_jobs(event_id, team_id, kind, send_at, payload, status, dedupe_key)
      select p_event, team_id, 'event', now(), jsonb_build_object(
        'automation', 'squad', 'pushTitle', headline,
        'pushBody', case when nominated then btrim(p_selected_message) else btrim(p_not_selected_message) end,
        'linkPath', link, 'recipientUserIds', jsonb_agg(user_id order by user_id)
      ), 'pending', 'tournament-squad:' || p_event::text || ':' || nominated::text || ':v' || publication.version
      from audience group by nominated
      returning id, payload
  )
  insert into public.notifications(user_id, team_id, event_id, title, message, link, type, read, event_type, source_notification_job_id)
    select recipient.user_id::uuid, team_id, p_event, headline, queued.payload->>'pushBody', link, 'auto', false, 'squad', queued.id
    from queued cross join lateral jsonb_array_elements_text(queued.payload->'recipientUserIds') as recipient(user_id)
    on conflict (source_notification_job_id, user_id) do nothing;

  return to_jsonb(publication);
end;
$$;

revoke all on function public.save_tournament_squad_draft(uuid, uuid[], uuid[]),
  public.publish_tournament_squad(uuid, uuid[], integer, text, text) from public, anon, authenticated;
grant execute on function public.save_tournament_squad_draft(uuid, uuid[], uuid[]),
  public.publish_tournament_squad(uuid, uuid[], integer, text, text) to authenticated;

notify pgrst, 'reload schema';
