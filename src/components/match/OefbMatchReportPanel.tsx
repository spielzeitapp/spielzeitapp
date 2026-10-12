import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Report = {
  id: string; home: string; away: string; score: string | null; venue: string; field: string;
  sourceUrl: string; updatedAt: string;
  events: { type: string; minute: number | null; side: string | null; player: string; secondPlayer: string; ownGoal: boolean; score: string | null }[];
  homePlayers: { name: string; number: string }[]; awayPlayers: { name: string; number: string }[];
};

/** Separate source panel: never writes to matches, statistics, feed or trainer fields. */
export function OefbMatchReportPanel({ eventId }: { eventId: string }) {
  const [state, setState] = useState<{ eventId: string; id: string | null; report: Report | null; error: string | null; loading: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let sourceId: string | null = null;
    async function refresh() {
      if (!sourceId) return;
      controller?.abort();
      const request = new AbortController(); controller = request;
      setState(previous => ({ eventId, id: sourceId, report: previous?.eventId === eventId ? previous.report : null, error: null, loading: true }));
      try {
        const response = await fetch(`/api/oefb/table?view=report&id=${sourceId}`, { cache: 'no-store', signal: request.signal });
        const data = await response.json();
        if (!response.ok || data.id !== sourceId || !Array.isArray(data.events)) throw new Error('unavailable');
        if (active && !request.signal.aborted) setState({ eventId, id: sourceId, report: data, error: null, loading: false });
      } catch {
        if (active && !request.signal.aborted) setState({ eventId, id: sourceId, report: null, error: 'ÖFB-Bericht derzeit nicht verfügbar. Du kannst das Original öffnen.', loading: false });
      }
    }
    void supabase.from('events').select('external_source, external_id').eq('id', eventId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      sourceId = !error && data?.external_source === 'oefb' && /^\d{1,10}$/.test(data.external_id ?? '') ? data.external_id : null;
      setState({ eventId, id: sourceId, report: null, error: null, loading: Boolean(sourceId) });
      void refresh();
    });
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller?.abort(); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [eventId]);
  if (state?.eventId !== eventId || !state.id) return null;
  const report = state.report;
  return <section className="mt-4 rounded-2xl border border-red-400/20 bg-black/35 p-4 text-white/85">
    <h3 className="font-bold text-white">ÖFB-Spielbericht</h3>
    <p className="mt-1 text-xs text-white/55">Vom ÖFB übernommen · separat von euren Trainerangaben</p>
    <a className="mt-3 inline-flex rounded-xl border border-red-400/25 px-3 py-2 text-sm font-bold text-red-200" href={`https://www.oefb.at/bewerbe/Spiel/Spielbericht/${state.id}/`} target="_blank" rel="noopener noreferrer">Originalbericht beim ÖFB ↗</a>
    {state.loading ? <p role="status" className="mt-3 text-sm text-white/60">ÖFB-Bericht wird aktualisiert…</p> : null}
    {state.error ? <p role="status" className="mt-3 text-sm text-amber-200">{state.error}</p> : null}
    {report ? <>
      <p className="mt-4 font-semibold">{report.home} – {report.away}{report.score ? ` · ${report.score}` : ''}</p>
      <p className="mt-1 text-sm text-white/60">{[report.venue, report.field].filter(Boolean).join(' · ')}</p>
      <h4 className="mt-4 text-sm font-bold">Torverlauf & Wechsel</h4>
      <p className="mt-1 text-xs text-white/50">Minuten laut ÖFB, ungeprüft. Keine Übernahme in eure Spielzeitstatistik.</p>
      {report.events.length ? <ul className="mt-2 divide-y divide-white/10">{report.events.map((e, i) => <li key={i} className="py-2 text-sm">
        <span className="text-red-200">{e.minute == null ? '—' : `${e.minute}′`}</span>{' '}
        {e.type === 'goal' ? `${e.ownGoal ? 'Eigentor' : 'Tor'}${e.score ? ` · ${e.score}` : ''}` : e.type === 'playerchange' ? 'Wechsel' : 'Karte'}
        {e.player ? ` · ${e.player}` : ''}{e.secondPlayer ? ` / ${e.secondPlayer}` : ''}
        <span className="block text-xs text-white/50">{e.side === 'home' ? report.home : e.side === 'away' ? report.away : ''}</span>
      </li>)}</ul> : <p className="mt-2 text-sm text-white/55">Keine Ereignisse veröffentlicht.</p>}
      <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm font-bold">Aufstellungen laut ÖFB</summary>
        {[{ name: report.home, players: report.homePlayers }, { name: report.away, players: report.awayPlayers }].map(side => <div key={side.name} className="mt-3">
          <h4 className="text-sm font-semibold">{side.name}</h4><p className="mt-1 text-sm text-white/65">{side.players.map(p => `${p.number ? `${p.number} · ` : ''}${p.name}`).join(', ') || 'Keine Aufstellung veröffentlicht.'}</p>
        </div>)}
      </details>
      <p className="mt-3 text-xs text-white/40">Abgerufen: {new Date(report.updatedAt).toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })}</p>
    </> : null}
  </section>;
}
