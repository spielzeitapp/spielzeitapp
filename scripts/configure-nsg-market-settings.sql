-- Run once per environment after verifying the local NSG/USC partnership.

begin;
do $configure$
declare root uuid; members uuid[];
begin
 select c.id into strict root from public.clubs c join private.exchange_join_settings s on s.club_id=c.id where c.name in ('NSG Gölsental','USC Rohrbach') and s.self_join_enabled;
 select array_agg(id) into members from public.clubs where name in ('NSG Gölsental','USC Rohrbach');
 if array_length(members,1)<>2 then raise exception 'Expected exactly the NSG/USC partnership';end if;
 insert into private.exchange_team_settings_sources(club_id,source_club_id) select unnest(members),root;
 -- Union existing real teams only, across the two local clubs. Trigger fills both pools.
 insert into public.exchange_partner_teams(club_id,team_id)
 select root,id from public.teams where club_id=any(members)
 union select root,team_id from public.exchange_partner_teams where club_id=any(members)
 on conflict(club_id,team_id) do nothing;
 -- Existing root links may not fire INSERT again, so explicitly fill both pools.
 insert into public.exchange_partner_teams(club_id,team_id)
 select m,p.team_id from unnest(members) m cross join public.exchange_partner_teams p where p.club_id=root
 on conflict(club_id,team_id) do nothing;
 -- Preserve the union of previously enabled choices, preferring existing meaningful aliases.
 update private.exchange_join_settings set parent_team_choices=(
 select jsonb_agg(jsonb_build_object('id',id,'label',label) order by id) from (
 select distinct on(e->>'id') e->>'id' id, e->>'label' label
 from private.exchange_join_settings s cross join lateral jsonb_array_elements(s.parent_team_choices) e
 where s.club_id=any(members)
 order by e->>'id',(nullif(e->>'label','') is not null) desc,(s.club_id=root) desc
 ) x),parent_team_version=parent_team_version+1 where club_id=root;
 -- Remove inactive duplicate storage; all readers and writers resolve to root.
 update private.exchange_join_settings set parent_team_choices=null,parent_team_version=0 where club_id=any(members) and club_id<>root;
end $configure$;
commit;
