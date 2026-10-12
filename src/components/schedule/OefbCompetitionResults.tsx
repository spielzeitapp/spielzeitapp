import { preferredClubLogo, useClubOpponentLogos } from '../../hooks/useClubOpponentLogos';
import { useCompetition } from '../../app/components/CompetitionContext';
import { MatchCardLigaportal } from '../../app/components/MatchCardLigaportal';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type Game = { home: string; away: string; homeLogo?: string | null; awayLogo?: string | null; round: number; kickoff: string; score: string | null; status: string; venue: string; sourceUrl: string | null };
type Results = { name: string; rounds: { id: number; label: string }[]; games: Game[]; round: number; updatedAt: string; sourceUrl: string };
const timeFormat = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' });
const teamKey = (name: string) => name.toLocaleLowerCase('de-AT').replace(/\bu\d+\b/g, '').replace(/\s+/g, ' ').trim();

export const OefbCompetitionResults: React.FC<{ competitionId: string; ourTeam: string; teamSeasonId?: string | null }> = ({ competitionId, ourTeam, teamSeasonId }) => {
  const [round, setRound] = useState(0);
  const [data, setData] = useState<Results | null>(null);
  const [rounds, setRounds] = useState<Results['rounds']>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const previousCompetition = useRef(competitionId);
  const automaticRoundChosen = useRef(false);
  const roundStrip = useRef<HTMLDivElement>(null);
  const competition = useCompetition();
  const clubLogos = useClubOpponentLogos(data?.games.flatMap((game) => [game.home, game.away]) ?? [],
    teamSeasonId === undefined ? (competition.settings?.competitionId === competitionId ? competition.selectedSeasonId : undefined) : teamSeasonId);
  useEffect(() => {
    roundStrip.current?.querySelector<HTMLElement>(`[data-round="${round}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [round, rounds.length]);
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
      if (!controller.signal.aborted) {
        setData(result); setRounds(result.rounds);
        if (round === 0 && !automaticRoundChosen.current) {
          automaticRoundChosen.current = true;
          const counts = new Map<number, number>();
          for (const game of (result as Results).games) if (game.round > 0) counts.set(game.round, (counts.get(game.round) ?? 0) + 1);
          const currentRound = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
          if (currentRound && (result as Results).rounds.some((item) => item.id === currentRound)) setRound(currentRound);
        }
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Ergebnisse konnten nicht geladen werden.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [competitionId, round]);

  useEffect(() => {
    if (previousCompetition.current !== competitionId) {
      previousCompetition.current = competitionId;
      automaticRoundChosen.current = false;
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
    <div ref={roundStrip} role="group" aria-label="Spieltag auswählen" className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[{ id: 0, label: 'Aktuelle Woche' }, ...rounds.filter((item) => item.id !== 0)].map((item) => {
        const dates = /\(([^)]+)\)/.exec(item.label)?.[1] ?? '';
        return <button key={item.id} type="button" data-round={item.id} aria-pressed={round === item.id}
          aria-label={item.id ? `${item.id}. Runde${dates ? ` · ${dates}` : ''}` : 'Aktuelle Woche'}
          onClick={() => { automaticRoundChosen.current = true; setRound(item.id); }}
          className={`min-h-[76px] min-w-[148px] shrink-0 snap-center rounded-2xl border px-4 py-3 text-center transition-colors ${round === item.id ? 'border-[rgb(var(--club-accent-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.7)] text-white' : 'border-white/10 bg-white/[0.04] text-white/60'}`}>
          <span className="block text-sm font-extrabold uppercase tracking-wide">{item.id ? `${item.id}. Runde` : 'Aktuelle Woche'}</span>
          {dates ? <span className="mt-1 block whitespace-nowrap text-xs">{dates}</span> : null}
        </button>;
      })}
    </div>
    <p className="text-xs text-white/50">Alle Mannschaften dieses Bewerbs · automatisch aktualisiert beim Öffnen und bei Rückkehr.</p>
    {error ? <p role="alert" className="text-sm text-amber-200">{error}{data ? ' Angezeigt wird der zuletzt geladene Stand.' : ''}</p> : null}
    {loading && !data ? <p role="status" className="text-sm text-white/55">Lade Begegnungen…</p> : null}
    {data && !data.games.length ? <p className="rounded-xl border border-white/10 p-4 text-sm text-white/65">Für diese Auswahl sind beim ÖFB keine Begegnungen verfügbar. Wähle eine andere Runde.</p> : null}
    <div className="space-y-2">{data?.games.map((game) => {
      const own = !!teamKey(ourTeam) && [game.home, game.away].some((team) => teamKey(team) === teamKey(ourTeam));
      const scores = game.score?.split(':').map(Number);
      const status = game.status === 'Endstand' ? 'finished' : game.status === 'Live' ? 'live' : game.status === 'Abgesagt' ? 'canceled' : 'upcoming';
      const ageGroup = /\bU\d{1,2}\b/i.exec(data.name)?.[0]?.toUpperCase();
      return <article key={`${game.kickoff}-${game.home}-${game.away}`} className="space-y-1">
        <div className="flex items-center justify-between px-2 text-[11px] text-white/50">
          <span>Runde {game.round}</span>{own ? <span className="font-semibold text-red-300">Unser Team</span> : null}
        </div>
        <MatchCardLigaportal ourTeamName={game.home} opponent={game.away} isHome={true}
          ageGroup={ageGroup} ourTeamLogoUrl={preferredClubLogo(game.home, clubLogos, game.homeLogo)}
          opponentLogoUrl={preferredClubLogo(game.away, clubLogos, game.awayLogo)}
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
