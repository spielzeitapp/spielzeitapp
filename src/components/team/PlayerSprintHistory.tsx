import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { bestSprintTime, compareSprintTests, formatSprintTime, sprintProgress, type SprintHistoryEntry } from '../../lib/sprintChallenge';
export function PlayerSprintHistory({ playerId, enabled, teamSeasonId }: { playerId: string; enabled: boolean; teamSeasonId?: string | null }) {
 const [history,setHistory] = useState<SprintHistoryEntry[]>([]);
 const [loading,setLoading] = useState(false);
 const [error,setError] = useState<string|null>(null);
 useEffect(() => {
  let current = true;
  setHistory([]); setError(null);
  if (!enabled) { setLoading(false); return; }
  setLoading(true);
  void (async () => {
   const response = await supabase.rpc('get_player_sprint_history',{p_player_id:playerId});
   if (!current) return;
   if (response.error) setError('Sprint-Zeiten konnten nicht geladen werden.');
   else setHistory((response.data ?? []).filter((row: Record<string,unknown>) => !teamSeasonId || String(row.team_season_id) === teamSeasonId).map((row: Record<string,unknown>) => ({
    playerId,testId:String(row.challenge_id),date:row.start_date as string|null,createdAt:String(row.created_at),
    method:row.measurement_method as SprintHistoryEntry['method'],attempts:[row.attempt_1_ms,row.attempt_2_ms,row.attempt_3_ms] as SprintHistoryEntry['attempts'],participation:row.participation as SprintHistoryEntry['participation']
   })));
   setLoading(false);
  })();
  return () => { current=false; };
 },[playerId,enabled,teamSeasonId]);
 if (!enabled) return null;
 const measured = history.filter(row => row.participation !== 'absent' && bestSprintTime(row.attempts) != null);
 const dateLabel = (row:SprintHistoryEntry) => new Date(row.date ? row.date+'T12:00:00' : row.createdAt).toLocaleDateString('de-AT');
 const label = (method:SprintHistoryEntry['method']) => method === 'light_gate' ? 'Lichtschranke' : method === 'hand' ? 'Handmessung' : 'Messart offen';
 return <section className="mb-4 rounded-2xl border sz-club-surface sz-club-surface--quiet p-3">
  <h4 className="text-lg font-bold text-white">Sprint · persönliche Bestleistungen</h4>
  <p className="mt-1 text-xs text-white/50">16,5 m · schnellster Versuch je Test · Messarten getrennt</p>
  {loading ? <p className="mt-3 text-sm text-white/55">Lade Sprint-Zeiten…</p> : error ? <p className="mt-3 text-sm text-amber-200" role="alert">{error}</p> : !measured.length ? <p className="mt-3 text-sm text-white/55">Noch keine Messwerte. Keine Bestzeit und keine Wertung.</p> : <>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{(['light_gate','hand',null] as const).map(method => {
    const rows = measured.filter(row => row.method === method);
    if (!rows.length) return null;
    const best = [...rows].sort((a,b) => bestSprintTime(a.attempts)!-bestSprintTime(b.attempts)! || compareSprintTests(a,b))[0];
    const latest = [...rows].sort(compareSprintTests).at(-1)!;
    const progress = sprintProgress(history,latest);
    return <div key={method ?? 'unknown'} className="rounded-xl border border-white/10 bg-black/25 p-3">
     <p className="text-xs text-white/55">{label(method)}</p><p className="sz-club-accent-text mt-1 text-2xl font-bold tabular-nums">{formatSprintTime(bestSprintTime(best.attempts))}</p>
     <p className="mt-1 text-xs text-white/50">Bestzeit vom {dateLabel(best)}</p>
     {progress.newPersonalBest ? <p className="mt-2 text-xs font-semibold text-emerald-300">Neue persönliche Bestzeit beim letzten Test!</p> : null}
     {progress.improvementMs != null ? <p className="mt-2 text-xs text-white/65">{progress.improvementMs > 0 ? 'Verbessert um ' : progress.improvementMs < 0 ? 'Langsamer um ' : 'Unverändert: '}{formatSprintTime(Math.abs(progress.improvementMs))} · {Math.abs(progress.improvementPercent ?? 0).toFixed(2).replace('.',',')} %</p> : <p className="mt-2 text-xs text-white/45">{method == null ? 'Ohne Messart kein Entwicklungsvergleich.' : 'Entwicklung ab zwei vergleichbaren Messungen.'}</p>}
    </div>;
   })}</div>
   <details className="mt-3 border-t border-white/10 pt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-white/70">Alle Sprint-Tests · {history.length}</summary>
    <ul className="space-y-2">{[...history].sort(compareSprintTests).reverse().map(row => <li key={row.testId} className="rounded-xl border border-white/10 bg-black/20 p-3">
     <div className="flex justify-between gap-2 text-sm text-white"><span>{dateLabel(row)} · {label(row.method)}</span><strong>{row.participation === 'absent' ? 'Nicht dabei' : formatSprintTime(bestSprintTime(row.attempts))}</strong></div>
     <p className="mt-1 text-xs text-white/50">{row.participation === 'absent' ? 'Keine Zeit · ohne Wertung' : row.attempts.map((time,index)=> 'V'+(index+1)+': '+formatSprintTime(time)).join(' · ')}</p>
    </li>)}</ul>
   </details>
  </>}
 </section>;
}
