import { MatchCardLigaportal } from '../../app/components/MatchCardLigaportal';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type Game = { home: string; away: string; homeLogo?: string | null; awayLogo?: string | null; round: number; kickoff: string; score: string | null; status: string; venue: string; sourceUrl: string | null };
type Results = { name: string; rounds: { id: number; label: string }[]; games: Game[]; round: number; updatedAt: string; sourceUrl: string };
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
      const scores = game.score?.split(':').map(Number);
      const status = game.status === 'Endstand' ? 'finished' : game.status === 'Live' ? 'live' : game.status === 'Abgesagt' ? 'canceled' : 'upcoming';
      const homeIsOurTeam = teamKey(game.home) === teamKey(ourTeam);
      const awayIsOurTeam = teamKey(game.away) === teamKey(ourTeam);
      const ageGroup = /\bU\d{1,2}\b/i.exec(data.name)?.[0]?.toUpperCase();
      return <article key={`${game.kickoff}-${game.home}-${game.away}`} className="space-y-1">
        <div className="flex items-center justify-between px-2 text-[11px] text-white/50">
          <span>Runde {game.round}</span>{own ? <span className="font-semibold text-red-300">Unser Team</span> : null}
        </div>
        <MatchCardLigaportal ourTeamName={game.home} opponent={game.away} isHome={true}
          ageGroup={ageGroup} ourTeamLogoUrl={homeIsOurTeam ? null : game.homeLogo}
          opponentLogoUrl={awayIsOurTeam ? null : game.awayLogo}
          startsAt={game.kickoff} status={status} kind="match" eventType="game" matchType="league"
          location={game.venue} scoreHome={scores?.[0] ?? null} scoreAway={scores?.[1] ?? null}
          role="fan" canManage={false} isPublicView scheduleNextMatchHero suppressInlineAttendanceChip
          suppressInlineAttendanceCounts className={own ? 'ring-1 ring-red-400/30' : ''} />
        {game.sourceUrl ? <a className="inline-flex min-h-[44px] items-center px-3 text-xs font-semibold text-red-300" href={game.sourceUrl} target="_blank" rel="noopener noreferrer">Beim ÖFB ansehen ↗</a> : null}
      </article>;
    })}</div>
    <p className="text-xs text-white/45">Hier siehst du alle Begegnungen des Bewerbs. Eure übernommenen Spiele stehen zusätzlich im Spielplan.
      {data ? <> · <a className="underline" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">Quelle: ÖFB</a> · abgerufen {timeFormat.format(new Date(data.updatedAt))}</> : null}
    </p>
  </section>;
};
