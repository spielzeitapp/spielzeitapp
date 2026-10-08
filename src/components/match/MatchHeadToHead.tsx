import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { filterHeadToHead, summarizeHeadToHead, type HeadToHeadMatch } from '../../lib/headToHead';

/** Reads only historical fixture results; archived rosters and seasons stay untouched. */
export function MatchHeadToHead({ matchId, teamSeasonId }: { matchId: string; teamSeasonId: string }) {
  const [matches, setMatches] = useState<HeadToHeadMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [season, setSeason] = useState('');
  const [venue, setVenue] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let canceled = false;
    setLoading(true); setError(false); setMatches([]); setSeason(''); setVenue('all'); setExpanded(false);
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_match_head_to_head', { p_match_id: matchId });
        if (canceled) return;
        if (rpcError || !Array.isArray(data)) { setError(true); return; }
        setMatches(data as HeadToHeadMatch[]);
      } catch { if (!canceled) setError(true); }
      finally { if (!canceled) setLoading(false); }
    })();
    return () => { canceled = true; };
  }, [matchId, retry]);
  const seasons = useMemo(() => [...new Map(matches.map(m => [m.team_season_id, m.season_name])).entries()], [matches]);
  const filtered = useMemo(() => filterHeadToHead(matches, season, venue), [matches, season, venue]);
  const summary = summarizeHeadToHead(filtered);
  const visible = expanded ? filtered : filtered.slice(0, 5);
  const selectClass = 'min-h-11 min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 text-xs text-white';
  return <section aria-label="Direkter Vergleich" className="rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
    <h2 className="text-sm font-bold uppercase tracking-wider text-white">Direkter Vergleich</h2>
    <p className="mt-1 text-xs text-white/50">Aus Sicht unserer Mannschaft · inklusive archivierter Saisonen</p>
    {loading ? <p className="mt-3 text-sm text-white/60" role="status">Vergleich wird geladen…</p>
      : error ? <div className="mt-3 text-sm text-white/60" role="status">Vergleich momentan nicht verfügbar.
        <button type="button" onClick={() => setRetry(n => n + 1)} className="ml-2 min-h-11 font-semibold text-white underline">Erneut versuchen</button>
      </div> : <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select aria-label="Saison für direkten Vergleich" className={selectClass} value={season} onChange={e => { setSeason(e.target.value); setExpanded(false); }}>
          <option value="">Alle Saisonen</option>
          <option value={teamSeasonId}>Saison dieses Spiels</option>
          {seasons.filter(([id]) => id !== teamSeasonId).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Heim oder Auswärts" className={selectClass} value={venue} onChange={e => { setVenue(e.target.value); setExpanded(false); }}>
          <option value="all">Heim &amp; Auswärts</option><option value="home">Heim</option><option value="away">Auswärts</option>
        </select>
      </div>
      {filtered.length === 0 ? <p className="mt-3 text-sm text-white/60">Keine abgeschlossenen direkten Duelle für diese Auswahl gespeichert.</p> : <>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[[summary.wins, 'Siege'], [summary.draws, 'Unentschieden'], [summary.losses, 'Niederlagen']].map(([value, label]) =>
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-1 py-2"><p className="text-2xl font-bold tabular-nums text-white">{value}</p><p className="text-[10px] text-white/60">{label}</p></div>)}
        </div>
        <p className="mt-3 text-center text-sm text-white/75">{summary.total} Duelle · Tore <strong className="tabular-nums text-white">{summary.goals}:{summary.conceded}</strong></p>
        {summary.unresolved > 0 && <p className="mt-2 text-xs text-amber-200">Bei {summary.unresolved} Duellen fehlen Ergebnis oder Teamzuordnung. Diese sind in der Liste, aber noch nicht in der Bilanz enthalten.</p>}
        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-white/70">Bisherige Begegnungen</h3>
        <ul className="mt-1 divide-y divide-white/10">
          {visible.map(m => <li key={m.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="text-xs text-white/55">{new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna' }).format(new Date(m.match_date))} · {m.season_name}</p>
              <p className="mt-0.5 break-words text-sm font-semibold text-white">{m.opponent}</p>
              <p className="text-[10px] text-white/45">{m.is_tournament ? 'Turnierspiel' : m.is_home === true ? 'Heimspiel' : m.is_home === false ? 'Auswärtsspiel' : 'Heim/Auswärts nicht hinterlegt'}</p>
            </div>
            <strong className="shrink-0 text-lg tabular-nums text-white">{m.team_goals == null || m.opponent_goals == null ? '—' : `${m.team_goals}:${m.opponent_goals}`}</strong>
          </li>)}
        </ul>
        {filtered.length > 5 && <button type="button" onClick={() => setExpanded(v => !v)} className="min-h-11 w-full text-sm font-semibold text-white underline">{expanded ? 'Weniger anzeigen' : `Alle ${filtered.length} Duelle anzeigen`}</button>}
      </>}
      <p className="mt-3 text-[10px] leading-relaxed text-white/40">Berücksichtigt werden gespeicherte Spiele derselben Mannschaft gegen denselben Gegner. Abweichende Vereinsnamen müssen eindeutig zugeordnet sein.</p>
    </>}
  </section>;
}
