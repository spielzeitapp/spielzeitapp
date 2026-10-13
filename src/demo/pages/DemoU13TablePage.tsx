import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageShell, PremiumCard, SectionTitle } from '../../ui';
import { CompetitionStandingsTable } from '../../components/schedule/CompetitionStandingsTable';
import { DemoTeamSelection } from '../components/DemoTeamSelection';
import { buildDemoU13Table, DEMO_U13_RESULTS, DEMO_U13_TEAM, DEMO_U13_TEAMS } from '../demoU13Competition';
import { demoFixtures } from '../demoFixtures';

export function DemoU13TablePage() {
  const [view, setView] = useState<'table' | 'results'>('table');
  return <PageShell>
    <Link to="/demo/spielplan" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-white/70"><ChevronLeft className="h-4 w-4" />Zum U12-Spielplan</Link>
    <DemoTeamSelection selected="u13" />
    <SectionTitle subtitle={`${DEMO_U13_TEAM} · Saison ${demoFixtures.seasonLabel}`}>U13 – Tabelle &amp; Liga</SectionTitle>
    <PremiumCard className="mb-5 p-4">
      <p className="text-sm font-semibold text-white">Demo-Tabelle mit fiktiven Daten</p>
      <p className="mt-2 text-sm leading-relaxed text-white/65">In der echten App wird ab U13 der verknüpfte ÖFB-Bewerb angezeigt. Diese Vorschau verwendet ausschließlich erfundene Mannschaften und Ergebnisse und ruft keine ÖFB-Daten ab.</p>
      <p className="mt-2 text-xs text-white/50">Die U12-Demo bleibt ohne Tabelle.</p>
    </PremiumCard>
    <div role="tablist" aria-label="U13-Ligaansicht" className="mb-4 flex flex-wrap gap-2">
      {([{ id: 'table', label: 'Tabelle' }, { id: 'results', label: 'Liga-Ergebnisse' }] as const).map(tab =>
        <button key={tab.id} id={`demo-u13-${tab.id}-tab`} aria-controls={`demo-u13-${tab.id}-panel`} role="tab" type="button"
          aria-selected={view === tab.id} onClick={() => setView(tab.id)}
          className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${view === tab.id ? 'border-red-400/45 bg-red-950/55 text-white' : 'border-white/10 bg-white/[0.04] text-white/70'}`}>{tab.label}</button>)}
    </div>
    <section role="tabpanel" id={`demo-u13-${view}-panel`} aria-labelledby={`demo-u13-${view}-tab`}>
      {view === 'table' ? <>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">U13 · Demo-Liga · nach 3 Spieltagen</h2>
        <CompetitionStandingsTable rows={buildDemoU13Table()} ourTeam={DEMO_U13_TEAM} />
        <p className="mt-3 text-xs leading-relaxed text-white/55">Sp = Spiele · S = Siege · U = Unentschieden · N = Niederlagen · Pkt = Punkte. Auf kleinen Bildschirmen kannst du die Tabelle seitlich wischen.</p>
      </> : <div className="space-y-3">{[3, 2, 1].map(round => <PremiumCard key={round} className="p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/60">{round}. Spieltag · fiktive Ergebnisse</h2>
        <ul className="space-y-3">{DEMO_U13_RESULTS.filter(match => match.round === round).map(match => <li key={`${round}-${match.home}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm text-white">
          <span className="text-right">{DEMO_U13_TEAMS[match.home]}</span><strong className="whitespace-nowrap tabular-nums">{match.homeGoals}:{match.awayGoals}</strong><span>{DEMO_U13_TEAMS[match.away]}</span>
        </li>)}</ul>
      </PremiumCard>)}</div>}
    </section>
  </PageShell>;
}
