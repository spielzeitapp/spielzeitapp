-- Live exercise flow stays on the existing staff-only training session.
-- Existing RLS, club/team assignments and archive permissions remain unchanged.
alter table public.training_sessions
 add column if not exists live_run jsonb,
 add column if not exists live_revision integer not null default 0;
alter table public.training_sessions add constraint training_live_run_shape check (
 live_revision >= 0 and (live_run is null or (
 jsonb_typeof(live_run) = 'object' and live_run->>'version' = '1'
 and jsonb_typeof(live_run->'exercises') = 'array'
 and jsonb_array_length(live_run->'exercises') between 1 and 80
 and live_run->>'phase' in ('explain','active','break','match','finished')
 and octet_length(live_run::text) <= 200000
 ))
);
create or replace function public.guard_training_live_run() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.live_run is not distinct from old.live_run and new.live_revision = old.live_revision then return new; end if;
 if new.live_revision <> old.live_revision + 1 or new.live_run is null then
  raise exception 'Trainingsablauf wurde geändert. Bitte neu laden';
 end if;
 if not coalesce(public.can_manage_training_team_season(new.team_season_id),false)
 or new.record_type = 'template' or new.status = 'archived'
 or not exists(select 1 from public.events e where e.id=new.event_id and e.kind='training' and e.status<>'canceled') then
  raise exception 'Trainingsablauf ist nicht bearbeitbar' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger training_live_run_guard before update on public.training_sessions
for each row execute function public.guard_training_live_run();
comment on column public.training_sessions.live_run is 'Exercise snapshots and active/explanation/break timing. Staff only via existing session RLS.';
