import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import { useDemoMode } from '../DemoContext';
import { PageShell, PremiumCard, SectionTitle } from '../../ui';
import { downloadSeasonPlanPdf, type SeasonPlanRow } from '../../lib/seasonPlanPdf';
import { downloadChampionshipSchedulePdf, formatPdfDateWithWeekday } from '../../lib/championshipPdf';
import { utcIsoToViennaTimeHHmm } from '../../lib/viennaTime';
import { DemoTeamSelection } from '../components/DemoTeamSelection';

export function DemoTeamSchedulePage() {
  const demo = useDemoMode();
  const [homeAway, setHomeAway] = useState<'all' | 'home' | 'away'>('all');
  const [venue, setVenue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo<SeasonPlanRow[]>(() => (demo?.data.events ?? [])
    .filter((e) => e.kind === 'match' || e.kind === 'tournament')
    .map<SeasonPlanRow>((e) => ({ id: e.id, kind: e.kind === 'tournament' ? 'tournament' : e.match_type === 'friendly' ? 'friendly' : 'championship',
      starts_at: e.starts_at, meeting_at: e.meeting_at, location: e.location,
      title: e.kind === 'tournament' ? 'Nachwuchsturnier' : 'Meisterschaftsspiel',
      is_home: e.is_home, opponent: e.opponent, opponent_logo_url: e.opponent_logo_url }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [demo?.data.events]);
  const filtered = rows.filter((r) => (!venue || r.location === venue) &&
    (homeAway === 'all' || (r.kind !== 'tournament' && r.is_home === (homeAway === 'home'))));
  const venues = [...new Set(rows.map((r) => r.location).filter(Boolean))];
  if (!demo) return null;
  const exportPdf = async (mode: 'champ' | 'season' | 'filtered') => {
    setBusy(true); setError(null);
    try {
      const selected = mode === 'champ' ? rows.filter((r) => r.kind === 'championship') : mode === 'filtered' ? filtered : rows;
      const logos = Object.fromEntries(selected.filter((r) => r.opponent && r.opponent_logo_url).map((r) => [r.opponent!, r.opponent_logo_url!]));
      const meta = { teamName: demo.data.teamName, ageGroup: 'U12', seasonName: demo.data.seasonLabel,
        teamLogoUrl: '/logos/nsg-goelsental.png', opponentLogoUrls: logos };
      const result = mode === 'champ' ? await downloadChampionshipSchedulePdf({ ...meta, mode: 'published',
        fixtures: selected.map((r) => ({ id: r.id, team_season_id: demo.data.teamSeasonId,
          opponent: r.opponent ?? null, is_home: r.is_home ?? null, starts_at: r.starts_at,
          meeting_at: r.meeting_at, location: r.location, venue_id: null, match_type: 'championship',
          competition: 'Meisterschaft', external_source: null, external_id: null, external_url: null,
          source_starts_at: null, fixture_status: 'published', opponent_logo_url: r.opponent_logo_url ?? null, notes: null })) })
        : await downloadSeasonPlanPdf({ ...meta, rows: selected,
        titleKind: mode === 'filtered' && homeAway === 'home' ? 'heim' : mode === 'filtered' && homeAway === 'away' ? 'auswaerts' : 'saison',
        venueSubtitle: mode === 'filtered' ? venue || null : null });
      if (result.error) setError(result.error);
    } catch (e) { setError(e instanceof Error ? e.message : 'PDF konnte nicht erstellt werden.'); }
    finally { setBusy(false); }
  };
  return <PageShell>
    <Link to="/demo/termine" className="mb-6 inline-flex min-h-[44px] items-center gap-1 text-white/70"><ChevronLeft className="h-4 w-4" />Zurück</Link>
    <DemoTeamSelection selected="u12" />
    <SectionTitle subtitle={`Saison ${demo.data.seasonLabel} · ${demo.data.teamName}`}>U12 – Spielplan</SectionTitle>
    <PremiumCard className="space-y-4 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-white/55">Spielart</p>
      <div className="flex flex-wrap gap-2">{(['all', 'home', 'away'] as const).map((key) => <button key={key} type="button" aria-pressed={homeAway === key}
        onClick={() => setHomeAway(key)} className={`min-h-[44px] rounded-full border px-4 py-2 font-semibold ${homeAway === key ? 'border-red-400/50 bg-red-950/60 text-white' : 'border-white/20 text-white/75'}`}>
        {{all:'Alle',home:'Heimspiele',away:'Auswärtsspiele'}[key]} {key === 'all' ? rows.length : rows.filter((r) => r.kind !== 'tournament' && r.is_home === (key === 'home')).length}
      </button>)}</div>
      <label className="block text-xs font-bold uppercase tracking-widest text-white/55" htmlFor="demo-plan-venue">Spielort</label>
      <select id="demo-plan-venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-white/20 bg-black px-3 text-white">
        <option value="">Alle Spielorte</option>{venues.map((v) => <option key={v} value={v!}>{v}</option>)}
      </select>
    </PremiumCard>
    <div className="my-5 grid gap-3">{([['champ','Meisterschaftsspielplan PDF'],['season','Saisonplan PDF'],['filtered','PDF für aktuelle Auswahl']] as const).map(([mode,label]) =>
      <button key={mode} type="button" disabled={busy || !(mode === 'filtered' ? filtered.length : rows.length)} onClick={() => void exportPdf(mode)}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 font-bold text-white disabled:opacity-40"><FileText className="h-5 w-5" />{busy ? 'PDF wird erstellt…' : label}</button>)}</div>
    {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
    <div className="space-y-3">{filtered.map((r) => <PremiumCard key={r.id} className="p-4">
      <Link to={`/demo/events/${r.id}`} className="block text-white">
        <p className="text-sm text-white/60">{formatPdfDateWithWeekday(r.starts_at)} · {utcIsoToViennaTimeHHmm(r.starts_at)} Uhr</p>
        <h2 className="mt-2 text-lg font-bold">{r.kind === 'tournament' ? r.title : r.is_home ? `${demo.data.teamName} – ${r.opponent}` : `${r.opponent} – ${demo.data.teamName}`}</h2>
        <p className="mt-1 text-sm text-white/70">{r.kind === 'tournament' ? 'Turnier' : r.is_home ? 'Heimspiel' : 'Auswärtsspiel'} · {r.location}</p>
        {r.meeting_at && <p className="mt-1 text-sm text-white/60">Treffpunkt {utcIsoToViennaTimeHHmm(r.meeting_at)} Uhr</p>}
      </Link>
    </PremiumCard>)}{!filtered.length && <p className="py-5 text-white/60">Keine Termine für diese Auswahl.</p>}</div>
  </PageShell>;
}
