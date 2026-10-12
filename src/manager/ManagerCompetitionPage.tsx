import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table2 } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import { getOefbTableSettings, type OefbTableSettings } from '../lib/oefbTableSettings';
import { formatTeamSeasonContextLabel } from '../lib/seasonLifecycle';
import { OefbCompetitionTable } from '../components/schedule/OefbCompetitionTable';
import { OefbCompetitionResults } from '../components/schedule/OefbCompetitionResults';

/** Read-only competition view follows the Manager header, independently of the app's table selection. */
export function ManagerCompetitionPage(): React.ReactElement {
  const { user, viewTeamSeason, selectedTeamSeason, viewTeamSeasonId, selectedTeamSeasonId } = useSession();
  const { supportSession } = useManagerWorkMode();
  const season = supportSession
    ? supportSession.teamSeasons.find(item => item.id === (viewTeamSeasonId ?? selectedTeamSeasonId)) ?? null
    : viewTeamSeason ?? selectedTeamSeason;
  const age = Number(/^U\s*(\d+)$/i.exec(String(season?.age_group || season?.team?.age_group || '').trim())?.[1]);
  const eligible = Number.isFinite(age) && age >= 13;
  const key = season && eligible ? `${user?.id ?? ''}:${season.id}` : null;
  const [result, setResult] = useState<{ key: string; data: OefbTableSettings | null; error: string | null } | null>(null);
  const [tab, setTab] = useState<'table' | 'results'>('table');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setTab('table');
    if (key && season) {
      getOefbTableSettings(season.id).then(value => {
        if (!cancelled) setResult({ key, ...value });
      }).catch(() => {
        if (!cancelled) setResult({ key, data: null, error: 'Die Tabellenzuordnung konnte nicht geladen werden.' });
      });
    }
    return () => { cancelled = true; };
  }, [key, retry]);
  const current = result?.key === key ? result : null;
  const settings = current?.data;
  const label = season ? formatTeamSeasonContextLabel({ displayName: season.display_name,
    ageGroup: season.age_group, teamName: season.team?.name, seasonName: season.season?.name,
    status: season.status }, { markArchived: true }) : 'Keine Mannschaft ausgewählt';

  return <div className="mx-auto max-w-6xl space-y-5">
    <header>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700"><Table2 className="h-5 w-5" />Meisterschaft</div>
      <h1 className="text-3xl font-bold text-slate-900">Tabelle & Liga</h1>
      <p className="mt-2 text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-sm text-slate-500">Wähle oben die Mannschaft und Saison, deren Bewerb du ansehen möchtest.</p>
    </header>
    {key && !current ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">Tabellenzuordnung wird geladen…</p> : null}
    {current?.error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <p>{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold">Erneut versuchen</button>
    </div> : null}
    {!season || !eligible || (current && !current.error && !settings) ? <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">{!season ? 'Mannschaft auswählen' : 'Keine ÖFB-Tabelle hinterlegt'}</h2>
      <p className="mt-2 text-sm text-slate-600">{!season ? 'Bitte wähle oben zuerst eine Mannschaft und Saison.' : !eligible ? 'Die Tabellenansicht ist für Mannschaften ab U13 vorgesehen. Spiele und Ergebnisse dieser Mannschaft findest du im Spielplan.' : 'Für diese Saison fehlt die Zuordnung zum ÖFB-Bewerb. Prüfe sie in der Saisonverwaltung.'}</p>
      {season ? <Link to={eligible ? '/manager/saisons' : '/app/termine'} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white">{eligible ? 'Saisonen öffnen' : 'Spielplan öffnen'}</Link> : null}
    </section> : null}
    {settings && season ? <section className="rounded-2xl border border-white/10 bg-[#101014] p-4 text-white shadow-sm sm:p-6">
      <div role="group" aria-label="Liga-Ansicht" className="mb-6 flex flex-wrap gap-2">
        {(['table', 'results'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}
          className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${tab === value ? 'border-red-500/60 bg-red-950 text-white' : 'border-white/15 bg-white/5 text-white/65'}`}>
          {value === 'table' ? 'Tabelle' : 'Liga-Ergebnisse'}
        </button>)}
      </div>
      {tab === 'table' ? <OefbCompetitionTable key={season.id} competitionId={settings.competitionId} sourceUrl={settings.sourceUrl} ourTeam={settings.teamName} teamSeasonId={season.id} />
        : <OefbCompetitionResults key={season.id} competitionId={settings.competitionId} ourTeam={settings.teamName} teamSeasonId={season.id} />}
    </section> : null}
  </div>;
}
