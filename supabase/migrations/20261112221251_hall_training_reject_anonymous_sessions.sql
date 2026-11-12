-- Explicitly exclude anonymous Auth sessions as well as the anon database role.
alter policy hall_training_staff_read on public.hall_training_days to authenticated
 using((select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false and exists(select 1 from public.events e where e.id=event_id and public.membership_is_staff_for_team_season(e.team_season_id)));
alter policy hall_training_staff_insert on public.hall_training_days to authenticated
 with check((select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false and exists(select 1 from public.events e join public.team_seasons ts on ts.id=e.team_season_id where e.id=event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft') and public.membership_is_staff_for_team_season(e.team_season_id)));
alter policy hall_training_staff_update on public.hall_training_days to authenticated
 using((select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false and exists(select 1 from public.events e where e.id=event_id and public.membership_is_staff_for_team_season(e.team_season_id)))
 with check((select coalesce((auth.jwt()->>'is_anonymous')::boolean,false))=false and exists(select 1 from public.events e join public.team_seasons ts on ts.id=e.team_season_id where e.id=event_id and e.kind='training' and e.status not in ('finished','canceled') and ts.status in ('active','draft') and public.membership_is_staff_for_team_season(e.team_season_id)));

