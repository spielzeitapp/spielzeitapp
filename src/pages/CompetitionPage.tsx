import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetition } from '../app/components/CompetitionContext';
import { OefbCompetitionTable } from '../components/schedule/OefbCompetitionTable';
import { OefbCompetitionResults } from '../components/schedule/OefbCompetitionResults';
import { PageShell, SectionTitle } from '../ui';

export const CompetitionPage: React.FC = () => {
  const { settings, loading, error } = useCompetition();
  const [view, setView] = useState<'table' | 'results'>('table');
  return <PageShell>
    <SectionTitle>Tabelle & Liga</SectionTitle>
    {loading ? <p role="status" className="text-sm text-white/60">Lade Tabellenzuordnung…</p> : null}
    {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : null}
    {!loading && !settings ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/65">Für die ausgewählte Mannschaft ist keine ÖFB-Tabelle hinterlegt. Wähle eine Mannschaft mit Tabelle.</p>
      <Link to="/app/termine" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-red-300">Zum Spielplan</Link>
    </div> : null}
    {settings ? <>
      <div role="tablist" aria-label="Ligaansicht" className="mb-4 flex gap-2">
        {([{ id: 'table', label: 'Tabelle' }, { id: 'results', label: 'Liga-Ergebnisse' }] as const).map((tab) => <button type="button" role="tab" key={tab.id} aria-selected={view === tab.id} onClick={() => setView(tab.id)} className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${view === tab.id ? 'border-red-400/45 bg-red-950/55 text-white' : 'border-white/10 bg-white/[0.04] text-white/70'}`}>{tab.label}</button>)}
      </div>
      {view === 'table' ? <OefbCompetitionTable key={settings.competitionId} {...settings} ourTeam={settings.teamName} /> : <OefbCompetitionResults key={settings.competitionId} competitionId={settings.competitionId} ourTeam={settings.teamName} />}
    </> : null}
  </PageShell>;
};
