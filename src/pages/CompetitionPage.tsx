import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetition } from '../app/components/CompetitionContext';
import { OefbCompetitionTable } from '../components/schedule/OefbCompetitionTable';
import { OefbCompetitionResults } from '../components/schedule/OefbCompetitionResults';
import { PageShell, SectionTitle } from '../ui';

export const CompetitionPage: React.FC = () => {
  const { settings, loading, error, options, selectedSeasonId, selectSeason } = useCompetition();
  const [view, setView] = useState<'table' | 'results'>('table');
  return <PageShell>
    <div className="flex items-center justify-between gap-2"><SectionTitle>Tabelle & Liga</SectionTitle></div>
    {loading ? <p role="status" className="text-sm text-white/60">Lade Tabellenzuordnung…</p> : null}
    {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : null}
    {options.length > 1 ? <label className="mb-4 block text-xs font-semibold text-white/65">Mannschaft mit Tabelle
      <select value={selectedSeasonId ?? ''} onChange={(event) => selectSeason(event.target.value)}
        className="mt-1 min-h-[44px] w-full rounded-xl border border-white/15 bg-[#101014] px-3 text-sm text-white">
        {options.map((option) => <option key={option.seasonId} value={option.seasonId}>{option.label}</option>)}
      </select>
    </label> : options.length === 1 ? <p className="mb-4 text-sm text-white/65">{options[0].label}</p> : null}
    {!loading && !settings ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/65">Für die ausgewählte Mannschaft ist keine ÖFB-Tabelle hinterlegt. Wähle eine Mannschaft mit Tabelle.</p>
      <Link to="/app/termine" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-red-300">Zum Spielplan</Link>
    </div> : null}
    {settings ? <>
      <div role="tablist" aria-label="Ligaansicht" className="mb-4 flex gap-2">
        {([{ id: 'table', label: 'Tabelle' }, { id: 'results', label: 'Liga-Ergebnisse' }] as const).map((tab) => <button type="button" role="tab" key={tab.id} aria-selected={view === tab.id} onClick={() => setView(tab.id)} className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${view === tab.id ? 'border-red-400/45 bg-red-950/55 text-white' : 'border-white/10 bg-white/[0.04] text-white/70'}`}>{tab.label}</button>)}
      </div>
      {view === 'table' ? <OefbCompetitionTable key={selectedSeasonId} {...settings} ourTeam={settings.teamName} /> : <OefbCompetitionResults key={selectedSeasonId} competitionId={settings.competitionId} ourTeam={settings.teamName} />}
    </> : null}
  </PageShell>;
};
