import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { supabase } from '../lib/supabaseClient';
import { isStagingApp } from '../lib/appEnvironment';
import { PageShell } from '../ui';
import type { ClubSeason } from '../features/club/uscClub';
import { exchangeMemberSeasonIds } from '../features/club/exchangeMemberships';
import '../features/club/clubExchange.css';

const Exchange = React.lazy(() => import('../features/club/ClubExchange').then(m => ({ default: m.ClubExchange })));
type Partner = { club_id: string; team_id: string; club: { name: string } | null };

export function ClubExchangePage() {
  const { user } = useAuth();
  const { selectedTeamSeason, teamSeasons, memberships, effectiveRole } = useSession();
  const [params, setParams] = useSearchParams();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [seasons, setSeasons] = useState<ClubSeason[]>([]);
  const [loadedClub, setLoadedClub] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const ownSeasons = useMemo(() => {
    const ids = exchangeMemberSeasonIds(memberships, effectiveRole);
    return teamSeasons.filter(s => ids.has(s.id) && (!s.status || s.status === 'active'));
  }, [teamSeasons, memberships, effectiveRole]);
  useEffect(() => {
    if (!user || !isStagingApp()) return;
    let active = true;
    setPartners(null); setError('');
    void (async () => {
      const result = await supabase.from('exchange_partner_teams').select('club_id,team_id,club:clubs(name)');
      if (!active) return;
      if (result.error) { setError('Die Vereinszuordnung konnte nicht geladen werden.'); return; }
      setPartners((result.data || []) as unknown as Partner[]);
    })().catch(() => { if (active) setError('Die Vereinszuordnung konnte nicht geladen werden.'); });
    return () => { active = false; };
  }, [user?.id, retry]);
  const contexts = useMemo(() => {
    const result = new Map<string, string>();
    for (const season of ownSeasons) {
      const team = season.team;
      const partner = partners?.find(p => p.team_id === team.id);
      const clubId = partner?.club_id || team.club_id;
      const club = Array.isArray(team.clubs) ? team.clubs[0] : team.clubs;
      if (clubId) result.set(clubId, partner?.club?.name || club?.name || team.name);
    }
    return result;
  }, [ownSeasons, partners]);
  const selectedTeam = selectedTeamSeason?.team;
  const selectedClub = partners?.find(p => p.team_id === selectedTeam?.id)?.club_id || selectedTeam?.club_id;
  const clubId = params.get('club') || (selectedClub && contexts.has(selectedClub) ? selectedClub : '') || contexts.keys().next().value || '';
  const ownClubSeasons = ownSeasons.filter(s => (partners?.find(p => p.team_id === s.team.id)?.club_id || s.team.club_id) === clubId);
  const ownTeamLabels = [...new Set(ownClubSeasons.map(s => s.age_group || s.display_name || s.team.name))];
  const defaultSeason = ownClubSeasons.find(s => s.id === selectedTeamSeason?.id) || ownClubSeasons[0];
  const defaultTeamLabel = defaultSeason ? defaultSeason.age_group || defaultSeason.display_name || defaultSeason.team.name : '';
  const permittedContext = contexts.has(clubId);
  useEffect(() => {
    if (!user || !clubId || !permittedContext || partners === null || !isStagingApp()) return;
    let active = true;
    setError(''); setLoadedClub(''); setSeasons([]);
    void (async () => {
      // Never load another club's teams before the backend confirms membership.
      const access = await supabase.rpc('exchange_access', { p_club_id: clubId });
      if (access.error) throw Error('Der Vereinszugang konnte nicht geprüft werden.');
      if (!access.data) { if (active) setLoadedClub(clubId); return; }
      const select = 'id,team_id,age_group,display_name,status,team:teams!inner(name,club_id),season:seasons(name)';
      const partnerIds = partners.filter(p => p.club_id === clubId).map(p => p.team_id);
      const results = await Promise.all([
        supabase.from('team_seasons').select(select).eq('team.club_id', clubId).eq('status', 'active'),
        ...(partnerIds.length ? [supabase.from('team_seasons').select(select).in('team_id', partnerIds).eq('status', 'active')] : []),
      ]);
      if (results.some(r => r.error)) throw Error('Die Mannschaften konnten nicht geladen werden.');
      if (active) {
        const rows = results.flatMap(r => r.data || []) as unknown as ClubSeason[];
        setSeasons([...new Map(rows.map(r => [r.id, r])).values()]); setLoadedClub(clubId);
      }
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : 'Tauschbörse konnte nicht geladen werden.'); });
    return () => { active = false; };
  }, [user?.id, clubId, permittedContext, partners, retry]);
  return <PageShell background="more" className="exchange-main px-3 py-5 sm:px-4" contentClassName="mx-auto w-full max-w-3xl">
    <Link className="inline-flex items-center gap-2 text-sm text-white/60" to="/app/mehr"><ArrowLeft size={17} /> Zurück zu Mehr</Link>
    {!isStagingApp() ? <p className="mt-5 text-white/70">Die Tauschbörse wird derzeit in TEST vorbereitet.</p> : !user ? <p>Bitte melde dich an.</p> : <>
      {partners !== null && contexts.size > 1 ? <details className="exchange-context-picker"><summary aria-label="Verein für die Tauschbörse wechseln"><ShieldCheck size={16} /><span>{contexts.get(clubId) || 'Deinen Verein wählen'}</span><ChevronDown size={15}/></summary><div aria-label="Deine Vereine">{[...contexts].map(([id,name]) => <button type="button" key={id} aria-pressed={clubId === id} onClick={e => { setParams({club:id}); e.currentTarget.closest('details')?.removeAttribute('open'); }}>{name}</button>)}</div></details> : partners !== null && contexts.size === 1 ? <div className="exchange-context-chip"><ShieldCheck size={15}/><span>{contexts.values().next().value}</span><small>Dein Verein</small></div> : null}
      {error ? <p role="alert" className="exchange-alert">{error} <button onClick={() => setRetry(n => n + 1)}>Erneut versuchen</button></p> : partners === null ? <p role="status">Vereinszuordnung wird geladen…</p> : !clubId ? <p className="exchange-hint">Für die Tauschbörse brauchst du eine aktive Eltern-, Trainer- oder Vereinszuordnung. Favoriten zählen nicht als Vereinszuordnung.</p> : !permittedContext ? <p className="exchange-hint">Diese Anfrage gehört nicht zu deinen zugeordneten Vereinen. <Link to="/app/tauschboerse">Zur eigenen Tauschbörse</Link></p> : loadedClub !== clubId ? <p role="status">Tauschbörse wird geladen…</p> : <React.Suspense fallback={<p role="status">Tauschbörse wird geladen…</p>}><Exchange key={`${user.id}:${clubId}`} clubId={clubId} userId={user.id} seasons={seasons} defaultTeamLabel={defaultTeamLabel} ownTeamLabels={ownTeamLabels} /></React.Suspense>}
    </>}
  </PageShell>;
}
