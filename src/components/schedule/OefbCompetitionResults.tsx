import React, { useCallback, useEffect, useRef, useState } from 'react';

type Game = { home: string; away: string; round: number; kickoff: string; score: string | null; status: string; venue: string; sourceUrl: string | null };
type Results = { name: string; rounds: { id: number; label: string }[]; games: Game[]; round: number; updatedAt: string; sourceUrl: string };
const dateFormat = new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' });
const timeFormat = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' });
const teamKey = (name: string) => name.toLocaleLowerCase('de-AT').replace(/\bu\d+\b/g, '').replace(/\s+/g, ' ').trim();

export const OefbCompetitionResults: React.FC<{ competitionId: string; ourTeam: string }> = ({ competitionId, ourTeam }) => {
  const [round, setRound] = useState(0);
  const [data, setData] = useState<Results | null>(null);
  const [rounds, setRounds] = useState<Results['rounds']>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const previousCompetition = useRef(competitionId);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastRefresh.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oefb/table?view=results&id=${encodeURIComponent(competitionId)}&round=${round}&refresh=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ergebnisse konnten nicht geladen werden.');
      if (!controller.signal.aborted) { setData(result); setRounds(result.rounds); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Ergebnisse konnten nicht geladen werden.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [competitionId, round]);

  useEffect(() => {
    if (previousCompetition.current !== competitionId) {
      previousCompetition.current = competitionId;
      setRounds([]);
      setData(null);
      if (round !== 0) { setRound(0); return; }
    }
    setData(null);
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current > 1000) void refresh(); };
    const online = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', visible);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      request.current?.abort();
      window.removeEventListener('focus', visible);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [competitionId, round, refresh]);

  return <section className="space-y-3" aria-label="ÖFB-Liga-Ergebnisse">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-white">{data?.name || 'Spiele & Ergebnisse'}</h2>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="sz-club-schedule-toolbar-action min-h-[44px] rounded-xl border px-3 text-xs font-semibold disabled:opacity-50">{loading ? 'Lade…' : 'Aktualisieren'}</button>
    </div>
    <label className="block text-xs text-white/65">Runde
      <select value={round} onChange={(event) => setRound(Number(event.target.value))} className="mt-1 w-full min-h-[44px] rounded-xl border border-white/15 bg-[#101014] px-3 text-sm text-white">
        <option value={0}>Aktuelle Woche</option>
        {rounds.filter((r) => r.id !== 0).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
    </label>
    <p className="text-xs text-white/50">Alle Mannschaften dieses Bewerbs · automatisch aktualisiert beim Öffnen und bei Rückkehr.</p>
    {error ? <p role="alert" className="text-sm text-amber-200">{error}{data ? ' Angezeigt wird der zuletzt geladene Stand.' : ''}</p> : null}
    {loading && !data ? <p role="status" className="text-sm text-white/55">Lade Begegnungen…</p> : null}
    {data && !data.games.length ? <p className="rounded-xl border border-white/10 p-4 text-sm text-white/65">Für diese Auswahl sind beim ÖFB keine Begegnungen verfügbar. Wähle eine andere Runde.</p> : null}
    <div className="space-y-2">{data?.games.map((game) => {
      const own = !!teamKey(ourTeam) && [game.home, game.away].some((team) => teamKey(team) === teamKey(ourTeam));
      const kickoff = new Date(game.kickoff);
      return <article key={`${game.kickoff}-${game.home}-${game.away}`} className={`rounded-2xl border p-4 ${own ? 'border-red-400/40 bg-red-950/35' : 'border-white/10 bg-white/[0.03]'}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1 text-xs text-white/55">
          <span>{dateFormat.format(kickoff)} · {timeFormat.format(kickoff)} · Runde {game.round}</span>
          {own ? <span className="font-semibold text-red-300">Unser Team</span> : null}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm text-white">
          <span className="break-words font-semibold">{game.home}</span>
          <div className="text-center"><strong className="whitespace-nowrap text-xl tabular-nums">{game.score ?? '–:–'}</strong><p className={`mt-1 text-[10px] ${game.status === 'Live' ? 'text-emerald-300' : 'text-white/50'}`}>{game.status}</p></div>
          <span className="break-words text-right font-semibold">{game.away}</span>
        </div>
        {game.venue ? <p className="mt-3 break-words text-xs text-white/45">{game.venue}</p> : null}
        {game.sourceUrl ? <a className="mt-3 inline-flex min-h-[44px] items-center text-xs font-semibold text-red-300" href={game.sourceUrl} target="_blank" rel="noopener noreferrer">Beim ÖFB ansehen ↗</a> : null}
      </article>;
    })}</div>
    <p className="text-xs text-white/45">Liga-Informationen werden nicht als eigene Teamtermine angelegt.
      {data ? <> · <a className="underline" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">Quelle: ÖFB</a> · abgerufen {timeFormat.format(new Date(data.updatedAt))}</> : null}
    </p>
  </section>;
};
