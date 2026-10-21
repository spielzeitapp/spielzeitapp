import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Person = { id: string; name: string };
type Props = { matchId: string; players: Person[]; benchIds: string[]; canManage: boolean; onChanged: () => void };

/** Post-match attendance corrections, never a way to edit the recorded playtime. */
export function FinishedMatchAttendance({ matchId, players, benchIds, canManage, onChanged }: Props) {
  const [absentIds, setAbsentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let canceled = false;
    setPending(null); setAbsentIds([]); setError(null); setLoading(true);
    void supabase.from('match_no_shows').select('player_id').eq('match_id', matchId).is('reverted_at', null).then(({data, error: failure}) => {
      if (canceled) return;
      setLoading(false);
      if (failure) setError('Anwesenheit konnte nicht geladen werden.');
      else setAbsentIds((data ?? []).map(row => row.player_id));
    });
    return () => { canceled = true; };
  }, [matchId, reload]);
  const name = (id: string) => players.find(player => player.id === id)?.name || 'Spieler';
  const change = useCallback(async (playerId: string, absent: boolean) => {
    if (!canManage || busy) return;
    setBusy(true); setError(null);
    try {
      const { error: failure } = await supabase.rpc('set_match_no_show', { p_match_id: matchId, p_player_id: playerId, p_absent: absent });
      if (failure) throw failure;
      setPending(null); setReload(value => value + 1); onChanged();
    } catch (failure) {
      setError(failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : 'Korrektur konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  }, [matchId, canManage, busy, onChanged]);
  if (!canManage && absentIds.length === 0) return null;
  return <section className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
    {absentIds.length > 0 && <div>
      <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Nicht erschienen</p>
      <ul className="mt-1 space-y-1">{absentIds.map(id => <li key={id} className="flex items-center justify-between gap-2 text-sm text-white/80">
        <span>{name(id)}</span>{canManage && <button type="button" disabled={busy} onClick={() => void change(id, false)} className="min-h-11 text-xs font-semibold text-white/60 underline disabled:opacity-40">Rückgängig</button>}
      </li>)}</ul>
    </div>}
    {canManage && <details className="mt-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-white/80">Kader nachträglich korrigieren</summary>
      <p className="text-xs leading-relaxed text-white/55">Nur für nominierte Spieler, die nicht da waren. Ein protokollierter Einsatz muss zuerst im Spielbericht geprüft werden.</p>
      {loading ? <p role="status" className="py-2 text-xs text-white/55">Anwesenheit wird geladen…</p> : <ul className="mt-2 space-y-1">
        {[...new Set(benchIds)].filter(id => !absentIds.includes(id)).map(id => <li key={id} className="flex items-center justify-between gap-2 text-sm text-white/80">
          <span>{name(id)}</span><button type="button" disabled={busy || !!error} onClick={() => setPending(id)} className="min-h-11 text-xs font-semibold text-amber-200 disabled:opacity-40">Nicht erschienen</button>
        </li>)}
      </ul>}
      {pending && <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-900/10 p-3 text-sm text-white/80">
        <p><strong>{name(pending)}</strong> war nicht beim Spiel? Der Spieler wird von der Bank entfernt und als „Nicht erschienen“ erfasst. Es zählt kein Einsatz.</p>
        <div className="mt-2 flex gap-3"><button type="button" disabled={busy} onClick={() => void change(pending, true)} className="min-h-11 rounded-xl bg-red-700 px-3 font-semibold text-white disabled:opacity-40">{busy ? 'Speichert…' : 'Bestätigen'}</button><button type="button" disabled={busy} onClick={() => setPending(null)} className="min-h-11 px-2">Abbrechen</button></div>
      </div>}
    </details>}
    {error && <p role="alert" className="mt-2 text-xs text-red-200">{error} <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)} className="min-h-11 underline">Neu laden</button></p>}
  </section>;
}
