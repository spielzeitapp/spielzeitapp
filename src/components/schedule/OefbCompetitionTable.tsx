import React, { useCallback, useEffect, useRef, useState } from 'react';
import { preferredClubLogo, useClubOpponentLogos } from '../../hooks/useClubOpponentLogos';
import { useCompetition } from '../../app/components/CompetitionContext';
import { CompetitionStandingsTable, type CompetitionTableRow } from './CompetitionStandingsTable';

type TableResponse = { name: string; rows: CompetitionTableRow[]; updatedAt: string; sourceUrl: string };

export const OefbCompetitionTable: React.FC<{ competitionId: string; sourceUrl: string; ourTeam: string; teamSeasonId?: string | null }> = ({
  competitionId, sourceUrl, ourTeam, teamSeasonId,
}) => {
  const [table, setTable] = useState<TableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { selectedSeasonId } = useCompetition();
  const clubLogos = useClubOpponentLogos(table?.rows.map(row => row.team) ?? [], teamSeasonId === undefined ? selectedSeasonId : teamSeasonId);

  const request = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const signal = controller.signal;
    lastRefresh.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oefb/table?id=${encodeURIComponent(competitionId)}&refresh=${Date.now()}`, {
        cache: 'no-store', signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tabelle konnte nicht geladen werden.');
      if (!signal.aborted) setTable(data as TableResponse);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Tabelle konnte nicht geladen werden.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    setTable(null);
    void refresh();
    const refreshWhenVisible = () => {
      // Visibility + focus often fire together when returning to a PWA.
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current > 1000) void refresh();
    };
    const refreshWhenOnline = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      request.current?.abort();
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  return (
    <section className="space-y-3" aria-label="ÖFB-Tabelle">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">{table?.name ?? 'ÖFB-Tabelle'}</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="sz-club-schedule-toolbar-action min-h-[44px] rounded-xl border px-3 text-xs font-semibold disabled:opacity-50">
          {loading ? 'Lade…' : 'Aktualisieren'}
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-amber-200">{error}{table ? ' Angezeigt wird der zuletzt geladene Stand.' : ' Bitte prüfe deine Verbindung.'}</p> : null}
      <p className="text-xs text-white/50" role="status">{loading && table ? 'ÖFB-Stand wird aktualisiert…' : 'Wird beim Öffnen und bei Rückkehr zur App automatisch aktualisiert.'}</p>
      {table ? (
        <CompetitionStandingsTable rows={table.rows} ourTeam={ourTeam}
          resolveLogo={row => preferredClubLogo(row.team, clubLogos, row.logo)} />
      ) : loading ? <p role="status" className="text-sm text-white/55">Lade ÖFB-Tabelle…</p> : null}
      <p className="text-xs text-white/50">
        Quelle: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">ÖFB-Bewerb</a>
        {table?.updatedAt ? ` · abgerufen ${new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(table.updatedAt))}` : ''}
      </p>
    </section>
  );
};
