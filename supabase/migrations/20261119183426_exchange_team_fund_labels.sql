-- Display fallbacks for teams without a custom parent-facing label.
create or replace function private.exchange_fund_own_teams(c uuid) returns table(id uuid,label text) language sql stable security definer set search_path='' as $$
 select distinct t.id,coalesce(private.exchange_parent_team_label(c,t.id),nullif(trim(concat_ws(' ',t.age_group,t.name)),''),'Team') from public.teams t where auth.uid() is not null and private.exchange_member(c) and (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_parent_team_allowed(c,t.id) and (
 exists(select 1 from private.exchange_member_teams m where m.club_id=c and m.user_id=auth.uid() and m.team_id=t.id)
 or exists(select 1 from public.memberships m join public.team_seasons s on s.id=m.team_season_id where s.team_id=t.id and s.status='active' and m.user_id=auth.uid() and m.role::text in ('parent','trainer','co_trainer','head_coach','admin'))
 or exists(select 1 from public.player_guardians g join public.team_season_players p on p.player_id=g.player_id join public.team_seasons s on s.id=p.team_season_id where g.user_id=auth.uid() and s.status='active' and s.team_id=t.id and p.left_at is null and p.is_active));
$$;
create or replace function private.exchange_fund_detail(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.exchange_listings; p private.exchange_fund_pledges;
begin
 select * into r from public.exchange_listings where id=l;
 if not found or not private.exchange_member(r.club_id) or (r.status='Entwurf' and r.owner_id<>auth.uid()) then raise exception 'Inserat nicht verfügbar.';end if;
 select * into p from private.exchange_fund_pledges where listing_id=l and status in ('pending','confirmed');
 return jsonb_build_object('payment_note',(select payment_note from private.exchange_fund_settings where club_id=r.club_id),'split',(select coalesce(jsonb_agg(jsonb_build_object('label',coalesce(private.exchange_parent_team_label(r.club_id,(x->>'team_id')::uuid),(select trim(concat_ws(' ',t.age_group,t.name)) from public.teams t where t.id=(x->>'team_id')::uuid),'Team'),'amount_cents',x->'amount_cents')),'[]') from jsonb_array_elements(r.team_fund_split) x),'pledge',case when p.buyer_id=auth.uid() or r.owner_id=auth.uid() then jsonb_build_object('id',p.id,'status',p.status,'reference',p.reference,'mine',p.buyer_id=auth.uid()) else null end,'taken',p.id is not null);
end; $$;
create or replace function private.exchange_fund_dashboard(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare allowed uuid[]; admin boolean:=auth.uid() is not null and public.can_manage_club_venues(c);
begin
 select coalesce(array_agg(t.id),'{}') into allowed from public.teams t where (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_fund_allowed(c,t.id);
 if cardinality(allowed)=0 and not admin then raise exception 'Keine Teamkassa freigeschaltet.';end if;
 return jsonb_build_object('admin',admin,'payment_note',(select payment_note from private.exchange_fund_settings where club_id=c),'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',coalesce(private.exchange_parent_team_label(c,t.id),nullif(trim(concat_ws(' ',t.age_group,t.name)),''),'Team'),'balance',coalesce((select sum(e.cents) from private.exchange_fund_entries e where e.club_id=c and e.team_id=t.id),0),'can_book',private.exchange_fund_allowed(c,t.id,true)) order by t.age_group,t.name),'[]') from public.teams t where t.id=any(allowed)),
 'pending',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'reference',p.reference,'amount_cents',p.amount_cents,'can_book',not exists(select 1 from jsonb_array_elements(p.split) x where not private.exchange_fund_allowed(c,(x->>'team_id')::uuid,true)),'created_at',p.created_at) order by p.created_at desc),'[]') from private.exchange_fund_pledges p where p.club_id=c and p.status='pending' and not exists(select 1 from jsonb_array_elements(p.split) x where not ((x->>'team_id')::uuid=any(allowed)))),
 'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select id,team_id,cents,kind,note,created_at,(select reference from private.exchange_fund_pledges p where p.id=pledge_id) as reference from private.exchange_fund_entries where club_id=c and team_id=any(allowed) order by created_at desc limit 200) e),
 'grants',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'team_id',a.team_id,'can_book',a.can_book)),'[]') from private.exchange_fund_access a where a.club_id=c) else '[]'::jsonb end);
end; $$;
