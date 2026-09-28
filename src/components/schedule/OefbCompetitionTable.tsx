import React, { useCallback, useEffect, useState } from 'react';

type TableRow = {
  rank: number; team: string; played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
};
type TableResponse = { name: string; rows: TableRow[]; updatedAt: string; sourceUrl: string };

export const OefbCompetitionTable: React.FC<{ competitionId: string; sourceUrl: string; ourTeam: string }> = ({
  competitionId, sourceUrl, ourTeam,
}) => {
  const [table, setTable] = useState<TableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oefb/table?id=${encodeURIComponent(competitionId)}`, {
        cache: 'no-store', signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tabelle konnte nicht geladen werden.');
      if (!signal?.aborted) setTable(data as TableResponse);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Tabelle konnte nicht geladen werden.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    setTable(null);
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
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
      {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : null}
      {table ? (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25">
          <table className="w-full min-w-[370px] text-xs tabular-nums text-white sm:text-sm">
            <thead className="border-b border-white/15 text-white/55"><tr>
              <th scope="col" className="p-2 text-left">#</th><th scope="col" className="p-2 text-left">Mannschaft</th>
              <th scope="col" className="p-2 text-right">Sp</th><th scope="col" className="p-2 text-right">S</th>
              <th scope="col" className="p-2 text-right">U</th><th scope="col" className="p-2 text-right">N</th>
              <th scope="col" className="p-2 text-right">Tore</th><th scope="col" className="p-2 text-right">Pkt</th>
            </tr></thead>
            <tbody>{table.rows.map((row) => (
              <tr key={`${row.rank}-${row.team}`} className={`border-b border-white/10 last:border-0 ${row.team.toLowerCase().includes(ourTeam.toLowerCase()) ? 'bg-red-950/55 font-bold' : ''}`}>
                <td className="p-2">{row.rank}</td><th scope="row" className="p-2 text-left font-medium">{row.team}</th>
                <td className="p-2 text-right">{row.played}</td><td className="p-2 text-right">{row.won}</td>
                <td className="p-2 text-right">{row.drawn}</td><td className="p-2 text-right">{row.lost}</td>
                <td className="p-2 text-right whitespace-nowrap">{row.goalsFor}:{row.goalsAgainst}</td>
                <td className="p-2 text-right font-bold">{row.points}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : loading ? <p role="status" className="text-sm text-white/55">Lade ÖFB-Tabelle…</p> : null}
      <p className="text-xs text-white/50">
        Quelle: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">ÖFB-Bewerb</a>
        {table?.updatedAt ? ` · abgerufen ${new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(table.updatedAt))}` : ''}
      </p>
    </section>
  );
};
