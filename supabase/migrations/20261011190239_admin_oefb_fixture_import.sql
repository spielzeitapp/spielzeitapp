-- Narrow write-only entry point for the existing platform-admin ÖFB setup workflow.
-- Does not grant SELECT on events or expose event records.
create function public.admin_import_oefb_fixture(p_team_season_id uuid, p_fixture jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare eid uuid; dt timestamptz; opp text; home boolean;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin(),false) then raise exception 'Platform admin required' using errcode='42501'; end if;
 perform 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id join public.clubs c on c.id=t.club_id
 where ts.id=p_team_season_id and ts.status in ('active','draft') and c.status='active' for share of ts;
 if not found then raise exception 'Season is read-only' using errcode='42501'; end if;
 if coalesce(p_fixture->>'external_id','') !~ '^\d{1,12}$' then raise exception 'Invalid ÖFB game ID'; end if;
 opp:=nullif(btrim(p_fixture->>'opponent'),''); dt:=(p_fixture->>'starts_at')::timestamptz; home:=(p_fixture->>'is_home')::boolean;
 if opp is null or length(opp)>200 or dt is null or home is null then raise exception 'Invalid fixture'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_team_season_id::text,0));
 select id into eid from public.events where team_season_id=p_team_season_id and external_source='oefb' and external_id=p_fixture->>'external_id' limit 1;
 if eid is not null then return jsonb_build_object('id',eid,'existing',true); end if;
 select id into eid from public.events where team_season_id=p_team_season_id and kind='match'
 and (starts_at at time zone 'Europe/Vienna')::date=(dt at time zone 'Europe/Vienna')::date
 and h2h_private.opponent_key(opponent)=h2h_private.opponent_key(opp) and (is_home is null or is_home=home) limit 1;
 if eid is not null then return jsonb_build_object('id',eid,'existing',true); end if;
 insert into public.events(team_season_id,kind,type,match_type,opponent,is_home,location,starts_at,status,attendance_mode,created_by,external_source,external_id,external_url,competition,source_starts_at,fixture_status,opponent_logo_url)
 values(p_team_season_id,'match','game','league',opp,home,p_fixture->>'location',dt,'upcoming','opt_in',auth.uid(),'oefb',p_fixture->>'external_id',p_fixture->>'external_url',p_fixture->>'competition',dt,'open',p_fixture->>'opponent_logo_url') returning id into eid;
 return jsonb_build_object('id',eid,'existing',false);
end; $$;
revoke all on function public.admin_import_oefb_fixture(uuid,jsonb) from public,anon;
grant execute on function public.admin_import_oefb_fixture(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
