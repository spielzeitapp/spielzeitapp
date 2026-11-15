import { tournamentTeamLabel } from '../../lib/tournamentDisplay';
import { TournamentFinalRanking } from '../../components/tournament/TournamentFinalRanking';
import { PublicTournamentMatchView, type PublicMatchView } from '../../components/tournament/PublicTournamentMatchView';
import { TournamentFanPlayerCard } from '../../components/tournament/TournamentFanPlayerCard';
import { TournamentFanFixture, TournamentFanFixtureRow, FanTeamLogo } from '../../components/tournament/TournamentFanFixture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, Moon, Sun, Share2 } from 'lucide-react';
import {
  fetchPublicTeamTournamentPage,
  groupPublicTournamentMatches,
  sharePublicTeamTournamentPage,
  type PublicTeamTournamentPageDto,
  type PublicTournamentPlayer,
} from '../../lib/publicTeamTournament';

export function PublicTeamTournamentPage(): React.ReactElement {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const location = useLocation();
  const candidate = (location.state as {returnTo?: unknown} | null)?.returnTo;
  const returnTo = typeof candidate === 'string' && /^\/(app|demo|manager)\//.test(candidate) ? candidate : `/app/events/${encodeURIComponent(publicId)}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const matchId = searchParams.get('spiel');
  const viewRaw = searchParams.get('ansicht');
  const matchView: PublicMatchView = viewRaw === 'formation' || viewRaw === 'ticker' || viewRaw === 'stats' ? viewRaw : 'overview';
  const requestId = useRef(0);
  const scrollSurface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollSurface.current?.scrollTo({ top: 0 });
  }, [publicId, matchId]);
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    try { return localStorage.getItem('sz:public-tournament-theme:v2') === 'night' ? 'night' : 'day'; }
    catch { return 'day'; }
  });
  useEffect(() => {
    try { localStorage.setItem('sz:public-tournament-theme:v2', theme); } catch { /* optional preference */ }
  }, [theme]);
  const toggleTheme = () => setTheme(current => current === 'night' ? 'day' : 'night');
  const [page, setPage] = useState<PublicTeamTournamentPageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    const request = ++requestId.current;
    if (!silent) setLoading(true);
    setError(null);
    const result = await fetchPublicTeamTournamentPage(publicId);
    if (request !== requestId.current) return;
    if (result.page) setPage(result.page);
    setError(result.error);
    setLoading(false);
  }, [publicId]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState !== 'hidden') void load(true); };
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      requestId.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const onShare = async () => {
    if (!page) return;
    const result = await sharePublicTeamTournamentPage(page.tournamentName, page.publicId);
    setShareHint(
      result === 'shared'
        ? 'Geteilt'
        : result === 'copied'
          ? 'Link kopiert'
          : 'Teilen nicht verfügbar',
    );
    window.setTimeout(() => setShareHint(null), 2200);
  };

  const card = 'rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] shadow-sm p-4';
  const [tab, setTab] = useState('ours');
  const heading = 'mb-2 text-sm font-extrabold uppercase tracking-[.08em] text-[var(--t-text)]';
  const scorerTotals = Object.values((page?.scorers ?? []).reduce((all,s)=>{const row=all[s.name]??{name:s.name,goals:0};row.goals+=s.goals;all[s.name]=row;return all;},{} as Record<string,{name:string;goals:number}>)).sort((a,b)=>b.goals-a.goals);
  const profileFor = (name: string): PublicTournamentPlayer => page?.fanPlayers?.find(player => player.name === name) ?? {
    name, firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' '), number: null, imageUrl: null,
  };
  const rosterPlayers = (page?.fanRoster ?? []).map(profileFor).sort((a,b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name, 'de'));
  const selectedMatch = page?.allMatches.find(match => match.id === matchId);
  const groupedMatches = groupPublicTournamentMatches(page?.allMatches ?? []);
  const renderOwnRow = (m: PublicTeamTournamentPageDto['allMatches'][number]) => page ? <Link key={m.id} to={`?spiel=${encodeURIComponent(m.id)}`} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]" aria-label={`${m.kickoffTimeLabel} · ${m.opponentName} · Zum Spiel`}><TournamentFanFixtureRow home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} groupLabel={m.phase==='group'?m.groupLabel:null} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/></Link> : null;
  const fixtures = (page?.schedule ?? []).filter(m => (tab !== 'final' || m.phase !== 'group') && !groupedMatches.live.some(live => live.kickoffTimeLabel===m.time && (m.homeTeam===page?.ownParticipantName || m.awayTeam===page?.ownParticipantName)));
  const scheduleFinished = (fixture: NonNullable<PublicTeamTournamentPageDto['schedule']>[number]) => {
    const own = (fixture.homeTeam === page?.ownParticipantName || fixture.awayTeam === page?.ownParticipantName) ? page?.allMatches.find(m=>m.kickoffTimeLabel===fixture.time) : null;
    return own ? own.status==='finished' : fixture.homeGoals!=null && fixture.awayGoals!=null;
  };
  const scheduledUpcoming = fixtures.filter(m=>!scheduleFinished(m)).sort((a,b)=>a.time.localeCompare(b.time));
  const scheduledResults = fixtures.filter(scheduleFinished).sort((a,b)=>b.time.localeCompare(a.time));
  const renderScheduledFixture = (fixture: NonNullable<PublicTeamTournamentPageDto['schedule']>[number], index: number) => {
    if (!page) return null;
    const own = (fixture.homeTeam === page.ownParticipantName || fixture.awayTeam === page.ownParticipantName)
      ? page.allMatches.find(match => match.kickoffTimeLabel === fixture.time) : null;
    if (own?.status === 'live') return null;
    const ownHome = fixture.homeTeam === page.ownParticipantName;
    const hg = own ? (ownHome ? own.scoreOur : own.scoreOpp) : fixture.homeGoals;
    const ag = own ? (ownHome ? own.scoreOpp : own.scoreOur) : fixture.awayGoals;
    const content = <><TournamentFanFixtureRow home={fixture.homeTeam} away={fixture.awayTeam} homeGoals={hg} awayGoals={ag} time={fixture.time} groupLabel={fixture.phase==='group'?fixture.groupLabel:null} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={own ? page.scorers?.filter(s=>s.time===fixture.time) : []}/>{fixture.phase!=='group' && fixture.roundLabel ? <p className="px-2 pb-2 text-xs text-[var(--t-muted)]">{fixture.roundLabel}</p> : null}</>;
    return own ? <Link key={fixture.id || index} to={`?spiel=${encodeURIComponent(own.id)}`} className="block rounded-xl" aria-label={`${own.opponentName} · Zum Spiel, Aufstellung und Spielverlauf`}>{content}</Link> : <React.Fragment key={fixture.id || index}>{content}</React.Fragment>;

  };
  return <div ref={scrollSurface} data-theme={theme} className={`public-tournament-page bg-[var(--t-bg)] text-[var(--t-text)]`} style={{
      '--t-accent': page?.accentColor ?? '#c82333',
      '--t-bg': theme === 'day' ? '#f7f8fa' : '#000000',
      '--t-surface': theme === 'day' ? '#ffffff' : '#0d0d10',
      '--t-text': theme === 'day' ? '#13151b' : '#ffffff',
      '--t-muted': theme === 'day' ? '#526071' : '#b5b5bc',
      '--t-border': theme === 'day' ? 'color-mix(in srgb, var(--t-accent) 18%, transparent)' : 'color-mix(in srgb, var(--t-accent) 28%, transparent)',
      '--t-fixture': theme === 'day' ? 'linear-gradient(135deg,#ffffff,#fff1f2)' : 'linear-gradient(135deg,#121114,#270e15)',
      '--t-player-badge': theme === 'day' ? '#f1f5f9' : 'rgba(0,0,0,.25)',
      '--t-live': theme === 'day' ? '#15803d' : '#6ee7b7',
      '--t-warning': theme === 'day' ? '#854d0e' : '#fcd34d',
      colorScheme: theme === 'day' ? 'light' : 'dark',
    } as React.CSSProperties}>
    <main className="mx-auto max-w-2xl space-y-3 px-3 pb-6 pt-[max(.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link to={selectedMatch ? location.pathname : returnTo} state={location.state} aria-label="Zurück zum Turnier" className="inline-flex min-h-11 items-center gap-2 text-base font-bold">← Turnier</Link>
        <div className="flex items-center gap-1">
          <details className="relative"><summary aria-label="Weitere Turnierbereiche" className="flex h-11 w-9 cursor-pointer list-none items-center justify-center text-xl font-bold">⋯</summary><div className="absolute right-0 top-full z-30 w-44 rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-1 shadow-lg">{[['final','Finalrunde'],['scorers','Torschützen'],['roster','Unser Team']].map(([id,label])=><button key={id} type="button" onClick={e=>{setTab(id);e.currentTarget.closest('details')?.removeAttribute('open');}} className={`block min-h-11 w-full rounded-lg px-3 text-left text-sm font-bold ${tab===id?'bg-[var(--t-accent)] text-white':''}`}>{label}</button>)}</div></details>
          <button type="button" onClick={()=>void onShare()} aria-label="Turnier teilen" className="flex h-11 w-11 items-center justify-center rounded-lg"><Share2 size={21} aria-hidden/></button>
          <button type="button" onClick={toggleTheme} aria-label={theme==='night'?'Tagmodus einschalten':'Nachtmodus einschalten'} className="flex h-11 w-11 items-center justify-center rounded-lg">{theme==='night'?<Sun size={23} aria-hidden/>:<Moon size={23} aria-hidden/>}</button>
        </div>
      </header>
      {shareHint ? <p role="status" className="text-sm text-[var(--t-muted)]">{shareHint}</p> : null}
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        {selectedMatch ? <PublicTournamentMatchView page={page} match={selectedMatch} view={matchView} onView={view=>setSearchParams({spiel:selectedMatch.id,ansicht:view})}/> : <>
        <section className="border-b border-[var(--t-border)] pb-2">
          <h1 className="text-lg font-extrabold leading-snug">{page.tournamentName}</h1>
          <details className="mt-0.5 text-sm text-[var(--t-muted)]"><summary className="min-h-8 cursor-pointer list-none py-1"><span>{page.dateLabel.replace(/^[^,]+,\s*/, '').replace(/\s*20\d{2}\.?\s*$/, '')}</span><span className="mx-1.5">·</span><span>Turnierinfos ⌄</span></summary><div className="space-y-1 pb-2 pt-1"><p>{[page.teamName,page.ageGroupLabel,page.seasonLabel].filter(Boolean).join(' · ')}</p><p className="flex items-center gap-1"><MapPin size={14}/>{page.venue}</p><p>{page.allMatches.some(m=>m.status==='live')?'Läuft':page.tournamentStatusLabel}{page.syncedAt?` · Veranstalterstand ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}`:''}</p></div></details>
        </section>
        {error?<p role="status" className="text-[var(--t-warning)]">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        {groupedMatches.live.length ? <section aria-label="Aktuelles Livespiel" aria-live="polite">{groupedMatches.live.map(m => <Link key={m.id} to={`?spiel=${encodeURIComponent(m.id)}`} className="block" aria-label={`${m.opponentName} · Livespiel öffnen`}><TournamentFanFixture prominent home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} clock={page.matchDetails?.find(d=>d.id===m.id)} homeGoals={m.scoreOur ?? 0} awayGoals={m.scoreOpp ?? 0} time={m.kickoffTimeLabel} phase={m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/></Link>)}</section> : null}
        <nav aria-label="Turnierbereiche" className="grid grid-cols-[1.55fr_.65fr_1fr_1fr] overflow-hidden rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)]">{[['ours','Unsere Spiele'],['games','Alle'],['tables','Tabelle'],['ticker','Ticker']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-10 whitespace-nowrap rounded-md border-0 px-1.5 text-[13px] font-bold shadow-none min-[380px]:text-sm ${tab===id?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label}</button>)}</nav>
        {tab==='ours'? <section className="space-y-3">
          {groupedMatches.upcoming.length ? <div className="space-y-1.5"><h2 className={heading}>Als Nächstes</h2>{groupedMatches.upcoming.map(renderOwnRow)}</div> : groupedMatches.live.length ? null : page.allMatches.length ? <p className="text-sm text-[var(--t-muted)]">Keine weiteren Spiele geplant.</p> : <>{(page.schedule ?? []).filter(m=>m.homeTeam===page.ownParticipantName || m.awayTeam===page.ownParticipantName).map(renderScheduledFixture)}{!(page.schedule ?? []).some(m=>m.homeTeam===page.ownParticipantName || m.awayTeam===page.ownParticipantName)?<p className={card}>Unsere Mannschaft ist noch nicht zugeordnet.</p>:null}</>}
          {groupedMatches.results.length ? <details open className="space-y-1.5"><summary className={`${heading} cursor-pointer py-1`}>Ergebnisse · {groupedMatches.results.length}</summary><div className="space-y-1.5">{groupedMatches.results.map(renderOwnRow)}</div></details> : null}
          {groupedMatches.canceled.length ? <details><summary className="cursor-pointer py-2 text-sm text-[var(--t-muted)]">Abgesagte Spiele · {groupedMatches.canceled.length}</summary><div className="space-y-1.5">{groupedMatches.canceled.map(renderOwnRow)}</div></details> : null}
        </section> : null}

        {tab==='tables'?<>{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-[var(--t-muted)]"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-[var(--t-border)]"><td className="py-2 font-bold">{r.rank || '–'}</td><td className="py-2 pr-2 font-semibold break-words"><span className="flex items-center gap-2">{<FanTeamLogo name={r.teamName} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>}<span title={r.teamName}>{tournamentTeamLabel(r.teamName)}</span></span></td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}{page.standingsProvisional?<details className="text-xs text-[var(--t-muted)]"><summary className="min-h-8 cursor-pointer py-2">Vorläufige Tabelle · Details</summary><p>Eigene abgeschlossene Spiele und Veranstalterergebnisse berücksichtigt. Sortierung: Punkte, Tordifferenz, erzielte Tore. Die offizielle Platzierung kann bei Gleichstand abweichen.</p></details>:<p className="text-xs text-[var(--t-muted)]">Veranstaltertabelle</p>}</>:null}
        {tab==='games'||tab==='final'? <section className="space-y-3"><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Gesamter Spielplan'}</h2>{!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:<>{scheduledUpcoming.length ? <div className="space-y-1.5"><h3 className="text-sm font-bold text-[var(--t-muted)]">Kommende Spiele</h3>{scheduledUpcoming.map(renderScheduledFixture)}</div>:null}{scheduledResults.length ? <details open><summary className="cursor-pointer py-2 font-bold text-[var(--t-accent)]">Ergebnisse · {scheduledResults.length}</summary><div className="space-y-1.5">{scheduledResults.map(renderScheduledFixture)}</div></details>:null}</>}{tab==='final'&&page.finalRanking?.length?<TournamentFinalRanking ranking={page.finalRanking} logos={page.teamLogos} ownName={page.ownParticipantName || page.teamName} ownLogo={page.teamLogoUrl}/>:null}</section>:null}

        {tab==='ticker'?<section className="space-y-3"><h2 className={heading}>Unser Turnier-Liveticker</h2>{page.allMatches.filter(m=>m.status==='live' || m.status==='finished').length ? [...groupedMatches.live,...groupedMatches.results].map(m=><PublicTournamentMatchView compact key={m.id} page={page} match={m} view="ticker" onView={view=>setSearchParams({spiel:m.id,ansicht:view})}/>) : <p className={card}>Sobald unser erstes Spiel gestartet wird, erscheint hier der Spielverlauf. Aufstellung und Vorbereitung findest du beim jeweiligen Spiel.</p>}</section>:null}
        {tab==='scorers'?<section className={card}><h2 className={heading}>Unsere Torschützenliste</h2>{page.scorers?.some(s=>s.example)?<p className="mb-3 text-sm text-[var(--t-warning)]">TEST-Beispieldaten aus unserem Kader – keine bestätigten historischen Torschützen.</p>:null}{scorerTotals.length?<ol className="space-y-3">{scorerTotals.map((s,i)=><li key={s.name}><TournamentFanPlayerCard player={profileFor(s.name)} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl} goals={s.goals} rank={i+1}/></li>)}</ol>:<p>Noch keine Torschützen erfasst.</p>}</section>:null}
        {tab==='roster'?<section className={card}><h2 className={heading}>Unser Team</h2>{page.fanRosterExample?<p className="mb-3 text-sm text-[var(--t-muted)]">TEST-Beispiel mit Bildern und Nummern aus unserem aktuellen Kader.</p>:null}{rosterPlayers.length?<ul className="space-y-3">{rosterPlayers.map(player=><li key={player.name}><TournamentFanPlayerCard player={player} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl}/></li>)}</ul>:<p>Der Turnierkader ist noch nicht festgelegt.</p>}</section>:null}
        </>}
        <Link to={returnTo} className="block min-h-11 py-3 text-right text-sm font-bold text-[var(--t-accent)]">Zum Turniercenter →</Link>
      </>}
    </main>
  </div>;
}
