import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformClub, listPlatformClubs, type ClubDetail } from '../lib/platformClubAdmin';
import { ManagerTeamDataStatus } from './ManagerTeamDataStatus';
import { supabase } from '../lib/supabaseClient';

type SharedTeam = ClubDetail['team_seasons'][number] & { clubName: string; clubId: string };

/** Persisted membership stays with its owner; source links only add a shared overview. */
export function ManagerClubTeamOverview({ detail, selectedSeasonId, onSelect }: { detail: ClubDetail; selectedSeasonId?: string; onSelect?: (id: string) => void }) {
  const [shared, setShared] = useState<SharedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setShared([]);
    void (async () => {
      try {
        const [sources, clubs] = await Promise.all([
          supabase.from('oefb_team_import_sources').select('team_season_id').eq('discovered_in_club_id', detail.id),
          listPlatformClubs(),
        ]);
        if (sources.error || clubs.error) throw Error('Verknüpfte Mannschaften konnten nicht geladen werden.');
        const ids = new Set((sources.data || []).map(s => s.team_season_id));
        const results = ids.size ? await Promise.all(clubs.data.filter(c => c.id !== detail.id && c.status === 'active').map(c => getPlatformClub(c.id))) : [];
        if (results.some(r => r.error)) throw Error('Verknüpfte Mannschaften konnten nicht vollständig geladen werden.');
        const found = results.flatMap(r => r.data ? r.data.team_seasons.filter(s => ids.has(s.id) && s.status !== 'archived').map(s => ({ ...s, clubName: r.data!.name, clubId: r.data!.id })) : []);
        if (active) setShared(found);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Übersicht konnte nicht geladen werden.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [detail]);
  const own = detail.team_seasons.filter(s => s.status !== 'archived');
  const withoutSeason = detail.teams.filter(t => !detail.team_seasons.some(s => s.team_id === t.id));
  const [filter, setFilter] = useState('all');
  const seasons = [...new Set([...own, ...shared].map(s => s.season_name).filter((s): s is string => Boolean(s)))].sort().reverse();
  const rows = [...own.map(s => ({ ...s, clubName: detail.name, clubId: detail.id })), ...shared].filter(s => filter === 'all' || s.season_name === filter);
  return <section aria-label="Mannschaftsübersicht" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{detail.name}</p><h2 className="text-xl font-bold">Mannschaften im Überblick</h2></div><label className="text-xs">Saison<select className="mt-1 block min-h-11 rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Alle Saisonen</option>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></label></div>
    <div className="space-y-4 p-4"><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-2 font-semibold">{own.length} eigene Mannschaftssaisonen</span><span className="rounded-full bg-emerald-100 px-3 py-2 font-semibold text-emerald-900">{loading ? '…' : shared.length} verknüpfte NSG-/SPG-Saisonen</span></div>
      <p className="text-sm text-slate-600">Eigene Teams und bestätigte ÖFB-Verknüpfungen. NSG-/SPG-Teams bleiben beim angezeigten Verein. Zuordnung bedeutet noch keinen vollständigen Datenimport.</p>
      {loading && <p role="status" className="text-sm text-slate-500">Verknüpfungen werden geladen…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(s => <article key={s.id} className={`rounded-xl border p-4 ${s.id === selectedSeasonId ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-bold"><Link aria-current={s.id === selectedSeasonId ? 'true' : undefined} onClick={e => { if (s.clubId === detail.id && onSelect) { e.preventDefault(); onSelect(s.id); } }} className="underline-offset-4 hover:underline" to={`/manager/vereine/${encodeURIComponent(s.clubId)}?setupSeason=${encodeURIComponent(s.id)}#manager-setup-checklist`}>{s.age_group || s.team_name} öffnen →</Link></h3><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{s.status === 'active' ? 'Aktiv' : 'In Vorbereitung'}</span></div><p className="font-medium">{s.team_name}</p><p className="mt-1 text-sm text-slate-600">{s.season_name} · {s.clubName}</p><p className="mt-2 text-xs font-semibold">{own.some(o => o.id === s.id) ? 'Eigene Mannschaft' : '✓ Verknüpft über ÖFB'}</p>
        <ManagerTeamDataStatus seasonId={s.id} setupUrl={`/manager/vereine/${encodeURIComponent(s.clubId)}?setupSeason=${encodeURIComponent(s.id)}#manager-setup-checklist`} />
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><Link className="underline" to={`/manager/saisons/${encodeURIComponent(s.id)}/kader`}>Kader</Link><Link className="underline" to={`/manager/saisons/${encodeURIComponent(s.id)}/oefb-import`}>Spiele &amp; Tabelle</Link></div>
      </article>)}</div>
      {!rows.length && !loading && <p className="text-sm text-slate-500">Noch keine Mannschaftssaison in dieser Auswahl.</p>}
      {withoutSeason.map(t => <p key={t.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{t.name}</strong> · Saison noch nicht angelegt</p>)}
    </div>
  </section>;
}
