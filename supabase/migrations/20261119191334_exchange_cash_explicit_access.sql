-- Team finance is opt-in per person and team, not an implicit trainer privilege.
create or replace function private.exchange_fund_allowed(c uuid,t uuid,booking boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.club_is_operable(c)
 and exists(select 1 from public.teams x where x.id=t and (x.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t)))
 and not exists(select 1 from private.exchange_members m where m.club_id=c and m.user_id=auth.uid() and m.revoked_at is not null)
 and (public.can_manage_club_venues(c) or exists(select 1 from private.exchange_fund_access a where a.club_id=c and a.user_id=auth.uid() and a.team_id=t and (not booking or a.can_book)));
$$;
create or replace function private.exchange_fund_dashboard(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare allowed uuid[]; admin boolean:=auth.uid() is not null and public.can_manage_club_venues(c);
begin
 select coalesce(array_agg(t.id),'{}') into allowed from public.teams t where (t.club_id=c or exists(select 1 from public.exchange_partner_teams p where p.club_id=c and p.team_id=t.id)) and private.exchange_fund_allowed(c,t.id);
 if cardinality(allowed)=0 and not admin then raise exception 'Keine Teamkassa freigeschaltet.';end if;
 return jsonb_build_object('admin',admin,'payment_note',(select payment_note from private.exchange_fund_settings where club_id=c),'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',coalesce(private.exchange_parent_team_label(c,t.id),nullif(trim(concat_ws(' ',t.age_group,t.name)),''),'Team'),'balance',coalesce((select sum(e.cents) from private.exchange_fund_entries e where e.club_id=c and e.team_id=t.id),0),'can_book',private.exchange_fund_allowed(c,t.id,true)) order by t.age_group,t.name),'[]') from public.teams t where t.id=any(allowed)),
 'pending',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'reference',p.reference,'amount_cents',p.amount_cents,'team_ids',(select jsonb_agg(x->'team_id') from jsonb_array_elements(p.split) x),'can_book',not exists(select 1 from jsonb_array_elements(p.split) x where not private.exchange_fund_allowed(c,(x->>'team_id')::uuid,true)),'created_at',p.created_at) order by p.created_at desc),'[]') from private.exchange_fund_pledges p where p.club_id=c and p.status='pending' and not exists(select 1 from jsonb_array_elements(p.split) x where not ((x->>'team_id')::uuid=any(allowed)))),
 'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select id,team_id,cents,kind,note,created_at,(select reference from private.exchange_fund_pledges p where p.id=pledge_id) as reference from private.exchange_fund_entries where club_id=c and team_id=any(allowed) order by created_at desc limit 200) e),
 'grants',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'team_id',a.team_id,'can_book',a.can_book)),'[]') from private.exchange_fund_access a where a.club_id=c) else '[]'::jsonb end);
end; $$;
