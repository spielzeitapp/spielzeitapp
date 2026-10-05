import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { supabase } from '../lib/supabaseClient';
import { MatchVideosPanel } from '../components/match/MatchVideosPanel';
import { useManagerWorkMode } from './ManagerWorkModeContext';

type MatchRow = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  location: string | null;
};

function matchLabel(match: MatchRow): string {
  const date = match.match_date
    ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date(match.match_date))
    : 'Ohne Datum';
  return `${date} · ${match.opponent || 'Spiel'}`;
}

export function ManagerMatchVideosPage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const { supportSession } = useManagerWorkMode();
  const contextSeason = supportSession?.teamSeasons.find(season => season.id === selectedTeamSeasonId)
    ?? viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;
  const [params, setParams] = useSearchParams();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedId = params.get('match');
  const selectedMatch = matches.find(match => match.id === requestedId) ?? matches[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!teamSeasonId) { setMatches([]); setLoading(false); return; }
    setLoading(true);
    void supabase.from('matches')
      .select('id,team_season_id,opponent,match_date,status,score_home,score_away,location')
      .eq('team_season_id', teamSeasonId)
      .order('match_date', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setMatches((data ?? []) as MatchRow[]);
        setError(loadError ? 'Spiele konnten nicht geladen werden.' : null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [teamSeasonId]);

  return <div className="manager-video-page mx-auto w-full max-w-[1600px] space-y-6 pb-10">
    <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between lg:p-7">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-700">Sport · Video</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Video &amp; Analyse</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">Clips hochladen, Szenen zuordnen und Highlights für dein Team freigeben.</p>
      </div>
      <label className="block w-full text-sm font-semibold text-slate-800 lg:w-[min(100%,32rem)]">
        Spiel auswählen
        <select value={selectedMatch?.id ?? ''} onChange={event => setParams({ match: event.target.value })} disabled={loading || matches.length === 0}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950">
          {matches.map(match => <option key={match.id} value={match.id}>{matchLabel(match)}</option>)}
        </select>
      </label>
    </header>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    {loading ? <p className="text-sm text-slate-600">Spiele werden geladen …</p> :
      !selectedMatch ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Für diese Mannschaft ist noch kein Spiel angelegt.</p> :
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-7 lg:px-9 lg:py-8">
        <MatchVideosPanel key={selectedMatch.id} matchId={selectedMatch.id} teamSeasonId={selectedMatch.team_season_id}
          canManage mode="videos" wide showResultHeader={false}
          matchInfo={{
            homeTeam: 'Unser Team', awayTeam: selectedMatch.opponent || 'Gegner',
            date: selectedMatch.match_date ? matchLabel(selectedMatch).split(' · ')[0] : undefined,
            score: selectedMatch.status === 'finished' && selectedMatch.score_home != null && selectedMatch.score_away != null
              ? `${selectedMatch.score_home}:${selectedMatch.score_away}` : undefined,
            location: selectedMatch.location,
          }} />
      </div>}
  </div>;
}
