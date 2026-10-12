import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { jugglingHistorySummary, type JugglingHistoryEntry } from '../../lib/jugglingHistory';
import { formatImprovementDelta, formatImprovementPercent } from '../../lib/challengeScoring';

type Props = { playerId: string; enabled: boolean; teamSeasonId?: string | null; seasonLabels?: Record<string,string> };
export function PlayerJugglingHistory({ playerId, enabled, teamSeasonId, seasonLabels = {} }: Props) {
  const [history,setHistory] = useState<JugglingHistoryEntry[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setHistory([]); setError(null);
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      const response = await supabase.rpc('get_player_juggling_history',{p_player_id:playerId});
      if (!current) return;
      if (response.error) setError('Gaberl-Werte konnten nicht geladen werden.');
      else setHistory((response.data ?? []).map((row: Record<string,unknown>) => ({
        id:String(row.challenge_id),teamSeasonId:String(row.team_season_id),title:String(row.title),
        startDate:row.start_date as string | null,createdAt:String(row.created_at),updatedAt:String(row.updated_at),
        start:Number(row.start_value),end:row.end_value == null ? null : Number(row.end_value),
        notes:row.notes as string | null,minStart:Number(row.min_start_for_percent) || 3,
      })));
      setLoading(false);
    })();
    return () => { current = false; };
  },[playerId,enabled]);
  if (!enabled) return null;
  const summary = jugglingHistorySummary(history,teamSeasonId);
  const label = (row:JugglingHistoryEntry) => seasonLabels[row.teamSeasonId] ?? row.title;
  const imported = (row:JugglingHistoryEntry) => row.notes?.includes('Startwert aus U11 2025/26 übernommen') ?? false;
  const date = (row:JugglingHistoryEntry) => new Date(row.updatedAt).toLocaleDateString('de-AT');
  return <section className="mb-4 min-w-0 rounded-2xl border sz-club-surface sz-club-surface--quiet p-3">
    <h4 className="text-lg font-bold text-white">Gaberl · persönliche Bestleistungen</h4>
    <p className="mt-1 text-xs text-white/50">Bestwert, Startwert und persönliche Entwicklung</p>
    {loading ? <p className="mt-3 text-sm text-white/55">Lade Gaberl-Werte…</p> : error ? <p className="mt-3 text-sm text-amber-200" role="alert">{error}</p> : !summary.bestRow ? <p className="mt-3 text-sm text-white/55">Noch keine Messwerte. Keine Bestleistung und keine Wertung.</p> : <>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="text-xs text-white/55">Persönlicher Bestwert{teamSeasonId ? ' · Gewählte Saison' : ' · Gesamt'}</p>
        <p className="sz-club-accent-text mt-1 text-2xl font-bold tabular-nums">{summary.best} <span className="text-sm">Gaberln</span></p>
        <p className="mt-1 text-xs text-white/50">{label(summary.bestRow)}</p>
        {summary.bestRow.end == null && imported(summary.bestRow) ? <p className="mt-1 text-xs text-white/50">U11-Bestwert als Startwert übernommen</p> : <p className="mt-1 text-xs text-white/50">Stand vom {date(summary.bestRow)}</p>}
        {summary.latest ? <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs text-white/65">Startwert: {summary.latest.start} Gaberln · {summary.latest.end == null ? 'Neue Messung offen' : 'Endwert: ' + summary.latest.end + ' Gaberln'}</p>
          {summary.delta != null ? <p className={'mt-1 text-xs font-semibold ' + (summary.delta > 0 ? 'text-emerald-300' : 'text-white/60')}>Entwicklung: {formatImprovementDelta(summary.delta)} Gaberln{summary.percent != null ? ' · ' + formatImprovementPercent(summary.percent) : ''}</p> : <p className="mt-1 text-xs text-white/45">Entwicklung wird nach der nächsten Messung berechnet.</p>}
        </div> : null}
      </div>
      <details className="mt-3 border-t border-white/10 pt-2">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-white/70">Alle Gaberl-Werte · {summary.rows.length}</summary>
        <ul className="space-y-2">{[...summary.rows].reverse().map(row => <li key={row.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="break-words text-sm font-semibold text-white">{label(row)}</p>
          <p className="mt-1 text-xs text-white/65">Startwert: {row.start} · {row.end == null ? 'Neue Messung offen' : 'Endwert: ' + row.end}</p>
          {imported(row) ? <p className="mt-1 text-xs text-white/45">Startwert aus U11 2025/26 übernommen</p> : null}
          <p className="mt-1 text-[11px] text-white/45">Stand vom {date(row)}</p>
        </li>)}</ul>
      </details>
    </>}
  </section>;
}
