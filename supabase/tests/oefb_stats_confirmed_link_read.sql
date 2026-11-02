begin;
do $$ declare n integer; uid uuid; begin
 if has_function_privilege('anon','public.read_oefb_stat_links(uuid[])','execute') then raise exception 'anon must not execute'; end if;
 select confirmed_by into uid from public.oefb_player_links limit 1;
 if uid is not null then
 perform set_config('request.jwt.claim.sub',uid::text,true);
 select count(*) into n from public.read_oefb_stat_links(array(select distinct team_season_id from public.oefb_player_links));
 if n=0 then raise exception 'confirmed user must read permitted links';end if;
 end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
 select count(*) into n from public.read_oefb_stat_links(array(select distinct team_season_id from public.oefb_player_links));
 if n<>0 then raise exception 'unrelated user read links';end if;
end $$;
rollback;
