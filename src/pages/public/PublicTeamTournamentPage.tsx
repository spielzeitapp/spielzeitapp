import {TournamentPresentation, TournamentPresentationTools} from '../../components/tournament/TournamentPresentation';
import { TournamentFinalRanking } from '../../components/tournament/TournamentFinalRanking';
import { PublicTournamentMatchView, type PublicMatchView } from '../../components/tournament/PublicTournamentMatchView';
import { TournamentFanPlayerCard } from '../../components/tournament/TournamentFanPlayerCard';
import { TournamentFanFixture, FanTeamLogo } from '../../components/tournament/TournamentFanFixture';
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
import { TournamentClubLogo } from '../../components/tournament/TournamentClubLogo';

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
  const [scheduleView,setScheduleView]=useState<'upcoming'|'results'>('upcoming');
  const heading = 'mb-3 text-[15px] font-extrabold uppercase tracking-[.14em] text-[var(--t-accent)]';
  const scorerTotals = Object.values((page?.scorers ?? []).reduce((all,s)=>{const row=all[s.name]??{name:s.name,goals:0};row.goals+=s.goals;all[s.name]=row;return all;},{} as Record<string,{name:string;goals:number}>)).sort((a,b)=>b.goals-a.goals);
  const profileFor = (name: string): PublicTournamentPlayer => page?.fanPlayers?.find(player => player.name === name) ?? {
    name, firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' '), number: null, imageUrl: null,
  };
  const rosterPlayers = (page?.fanRoster ?? []).map(profileFor).sort((a,b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name, 'de'));
  const selectedMatch = page?.allMatches.find(match => match.id === matchId);
  const groupedMatches = groupPublicTournamentMatches(page?.allMatches ?? []);
  const featuredMatch = groupedMatches.live[0] ?? groupedMatches.upcoming[0] ?? null;
  const renderOwnCard = (m: PublicTeamTournamentPageDto['allMatches'][number], prominent=false) => page ? <Link key={m.id} to={`?spiel=${encodeURIComponent(m.id)}`} className="block overflow-hidden rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]" aria-label={`${m.kickoffTimeLabel} · ${m.opponentName} · Zum Spiel`}><TournamentFanFixture prominent={prominent} home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} clock={page.matchDetails?.find(d=>d.id===m.id)} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} phase={m.groupLabel?`Gruppe ${m.groupLabel}`:'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/><p className="border-t border-[var(--t-border)] px-4 py-3 text-sm font-bold text-[var(--t-accent)]">{m.status==='finished'?'Spielverlauf öffnen':'Zum Spiel'} →</p></Link> : null;
  const fixtures = (page?.schedule ?? []).filter(m => (tab !== 'final' || m.phase !== 'group') && !([...(groupedMatches.live),...(featuredMatch?[featuredMatch]:[])]).some(live => live.kickoffTimeLabel===m.time && (m.homeTeam===page?.ownParticipantName || m.awayTeam===page?.ownParticipantName)));
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
    const content = <><TournamentFanFixture home={fixture.homeTeam} away={fixture.awayTeam} homeGoals={hg} awayGoals={ag} time={fixture.time} phase={fixture.roundLabel || (fixture.groupLabel?`Gruppe ${fixture.groupLabel}`:'Turnierspiel')} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={own ? page.scorers?.filter(s=>s.time===fixture.time) : []}/>{fixture.phase!=='group' && fixture.roundLabel ? <p className="px-2 pb-2 text-xs text-[var(--t-muted)]">{fixture.roundLabel}</p> : null}</>;
    return own ? <Link key={fixture.id || index} to={`?spiel=${encodeURIComponent(own.id)}`} className="block rounded-xl" aria-label={`${own.opponentName} · Zum Spiel, Aufstellung und Spielverlauf`}>{content}</Link> : <React.Fragment key={fixture.id || index}>{content}</React.Fragment>;

  };
  const presentationMode=searchParams.get('modus');
  if(page && (presentationMode==='screen'||presentationMode==='print')) return <TournamentPresentation page={page} mode={presentationMode} error={error}/>;
  return <div ref={scrollSurface} data-theme={theme} className={`public-tournament-page bg-[var(--t-bg)] text-[var(--t-text)]`} style={{
      '--t-accent': page?.accentColor ?? '#c82333',
      '--t-bg': theme === 'day' ? '#f7f8fa' : '#000000',
      '--t-surface': theme === 'day' ? '#ffffff' : '#0d0d10',
      '--t-text': theme === 'day' ? '#13151b' : '#ffffff',
      '--t-muted': theme === 'day' ? '#526071' : '#b5b5bc',
      '--t-border': theme === 'day' ? 'color-mix(in srgb, var(--t-accent) 18%, transparent)' : 'color-mix(in srgb, var(--t-accent) 28%, transparent)',
      '--t-fixture': theme === 'day' ? 'linear-gradient(135deg,#ffffff,#fff1f2)' : 'linear-gradient(135deg,#121114,#270e15)',
      '--t-player-badge': theme === 'day' ? '#f1f5f9' : 'rgba(0,0,0,.25)',
      '--t-live': theme==='day'?'#15803d':'#6ee7b7',
      '--t-warning': theme === 'day' ? '#854d0e' : '#fcd34d',
      colorScheme: theme === 'day' ? 'light' : 'dark',
    } as React.CSSProperties}>
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link to={selectedMatch ? location.pathname : returnTo} state={location.state} aria-label="Zurück zum Turnier" className="inline-flex min-h-11 min-w-0 items-center rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-sm font-bold">← Zurück<span className="ml-1 hidden min-[380px]:inline">zum Turnier</span></Link>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={()=>void onShare()} className="flex h-11 items-center gap-2 rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 text-sm font-bold"><Share2 size={18} aria-hidden/>Teilen</button>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten'} title={theme === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text)]">{theme === 'night' ? <Sun size={20} aria-hidden/> : <Moon size={20} aria-hidden/>}</button>
        </div>
      </header>
      {shareHint ? <p role="status" className="text-sm text-[var(--t-muted)]">{shareHint}</p> : null}
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        <TournamentPresentationTools page={page} onShare={()=>void onShare()}/>
        {selectedMatch ? <PublicTournamentMatchView page={page} match={selectedMatch} view={matchView} onView={view=>setSearchParams({spiel:selectedMatch.id,ansicht:view})}/> : <>
        <section className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-3">
          <div className="flex items-center gap-3"><TournamentClubLogo name={page.teamName} logoUrl={page.teamLogoUrl} size="sm"/><div className="min-w-0 flex-1"><h1 className="text-base font-extrabold leading-snug">{page.tournamentName}</h1><p className="mt-1 text-xs text-[var(--t-muted)]">{page.dateLabel} · {page.ageGroupLabel}</p></div></div>
          <details className="mt-2 text-xs text-[var(--t-muted)]"><summary className="cursor-pointer py-1 font-semibold">Turnierinfos & Aktualisierung</summary><p className="mt-2">{[page.teamName,page.seasonLabel].filter(Boolean).join(' · ')}</p><p className="mt-1 flex items-center gap-1"><MapPin size={14}/>{page.venue}</p><p className="mt-1">{page.allMatches.some(m=>m.status==='live')?'Läuft':page.tournamentStatusLabel}{page.syncedAt ? ` · Veranstalterstand ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}` : ''}</p></details>
        </section>
        {error?<p role="status" className="text-[var(--t-warning)]">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        {featuredMatch ? <section aria-label={featuredMatch.status==='live'?'Aktuelles Livespiel':'Nächstes eigenes Spiel'}>{renderOwnCard(featuredMatch,true)}</section> : null}
        <nav aria-label="Turnierbereiche" className="space-y-1 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-1">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4" role="group" aria-label="Spiele und Tabelle">{[['ours','Unsere Spiele'],['games','Alle Spiele'],['ticker','Liveticker'],['tables','Tabellen']].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-11 min-w-0 rounded-xl px-2 text-sm font-bold ${tab===id?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label}</button>)}</div>
          <div className="grid grid-cols-3 gap-1 border-t border-[var(--t-border)] pt-1" role="group" aria-label="Finalrunde, Torschützen und Mannschaft">{[['final','Finalrunde'],['scorers','Torschützen'],['roster','Unser Team']].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-11 min-w-0 rounded-xl px-1 text-[13px] font-bold sm:text-sm ${tab===id?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label}</button>)}</div>
        </nav>
        {tab==='ours'? <section className="space-y-4">
          {groupedMatches.upcoming.some(m=>m.id!==featuredMatch?.id) ? <div className="space-y-2"><h2 className={heading}>{featuredMatch?.status==='live'?'Danach':'Weitere Spiele'}</h2>{groupedMatches.upcoming.filter(m=>m.id!==featuredMatch?.id).map(m=>renderOwnCard(m))}</div> : groupedMatches.live.length ? null : page.allMatches.length ? <p className="text-sm text-[var(--t-muted)]">Keine weiteren Spiele geplant.</p> : <>{(page.schedule ?? []).filter(m=>m.homeTeam===page.ownParticipantName || m.awayTeam===page.ownParticipantName).map(renderScheduledFixture)}{!(page.schedule ?? []).some(m=>m.homeTeam===page.ownParticipantName || m.awayTeam===page.ownParticipantName)?<p className={card}>Unsere Mannschaft ist noch nicht zugeordnet.</p>:null}</>}
          {groupedMatches.results.length ? <div className="space-y-3"><h2 className={heading}>Letztes Ergebnis</h2>{renderOwnCard(groupedMatches.results[0])}{groupedMatches.results.length>1?<details><summary className="min-h-11 cursor-pointer py-3 font-bold text-[var(--t-accent)]">Weitere Ergebnisse · {groupedMatches.results.length-1}</summary><div className="space-y-4">{groupedMatches.results.slice(1).map(m=>renderOwnCard(m))}</div></details>:null}</div>:null}
          {groupedMatches.canceled.length ? <details><summary className="cursor-pointer py-2 text-sm text-[var(--t-muted)]">Abgesagte Spiele · {groupedMatches.canceled.length}</summary><div className="space-y-2">{groupedMatches.canceled.map(m=>renderOwnCard(m))}</div></details> : null}
        </section> : null}

        {tab==='tables'?<>{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-[var(--t-muted)]"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-[var(--t-border)]"><td className="py-3 font-bold">{r.rank || '–'}</td><td className="py-3 pr-2 font-semibold break-words"><span className="flex items-center gap-2">{<FanTeamLogo name={r.teamName} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>}{r.teamName}</span></td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}<p className="text-sm text-[var(--t-muted)]">{page.standingsProvisional ? 'Vorläufig · eigene abgeschlossene Spiele und Veranstalterergebnisse berücksichtigt. Sortierung: Punkte, Tordifferenz, erzielte Tore; die offizielle Platzierung kann bei Gleichstand abweichen.' : 'Veranstaltertabelle'}</p></>:null}
        {tab==='games'||tab==='final'? <section className="space-y-4"><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Spielplan & Ergebnisse'}</h2>
          {tab==='games'?<><div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-1" role="group" aria-label="Spielplan oder Ergebnisse">{([['upcoming','Spielplan',scheduledUpcoming.length],['results','Ergebnisse',scheduledResults.length]] as const).map(([value,label,count])=><button key={value} type="button" aria-pressed={scheduleView===value} onClick={()=>setScheduleView(value)} className={`min-h-11 rounded-xl px-2 text-sm font-bold ${scheduleView===value?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label} · {count}</button>)}</div>{scheduleView==='upcoming'?(scheduledUpcoming.length?scheduledUpcoming.map(renderScheduledFixture):<p className={card}>Keine weiteren Spiele geplant.</p>):(scheduledResults.length?scheduledResults.map(renderScheduledFixture):<p className={card}>Noch keine Ergebnisse vorhanden.</p>)}</>:!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:<>{scheduledUpcoming.map(renderScheduledFixture)}{scheduledResults.map(renderScheduledFixture)}</>}
          {tab==='final'&&page.finalRanking?.length?<TournamentFinalRanking ranking={page.finalRanking} logos={page.teamLogos} ownName={page.ownParticipantName || page.teamName} ownLogo={page.teamLogoUrl}/>:null}</section>:null}


        {tab==='ticker'?<section className="space-y-4"><h2 className={heading}>Unser Turnier-Liveticker</h2>{groupedMatches.live.map(m=><PublicTournamentMatchView key={m.id} timelineOnly page={page} match={m} view="ticker" onView={view=>setSearchParams({spiel:m.id,ansicht:view})}/>)}{groupedMatches.results.map(m=><details key={m.id} className="overflow-hidden rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)]"><summary className="cursor-pointer list-none"><TournamentFanFixture home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} phase={m.groupLabel?`Gruppe ${m.groupLabel}`:'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl}/><span className="block border-t border-[var(--t-border)] px-4 py-3 text-sm font-bold text-[var(--t-accent)]">Spielverlauf aufklappen ⌄</span></summary><PublicTournamentMatchView timelineOnly page={page} match={m} view="ticker" onView={view=>setSearchParams({spiel:m.id,ansicht:view})}/></details>)}{!groupedMatches.live.length&&!groupedMatches.results.length?<p className={card}>Noch keine Spiele mitgetickert.</p>:null}</section>:null}

        {tab==='scorers'?<section className={card}><h2 className={heading}>Unsere Torschützenliste</h2>{page.scorers?.some(s=>s.example)?<p className="mb-3 text-sm text-[var(--t-warning)]">TEST-Beispieldaten aus unserem Kader – keine bestätigten historischen Torschützen.</p>:null}{scorerTotals.length?<ol className="space-y-3">{scorerTotals.map((s,i)=><li key={s.name}><TournamentFanPlayerCard player={profileFor(s.name)} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl} goals={s.goals} rank={i+1}/></li>)}</ol>:<p>Noch keine Torschützen erfasst.</p>}</section>:null}
        {tab==='roster'?<section className={card}><h2 className={heading}>Unser Team</h2>{page.fanRosterExample?<p className="mb-3 text-sm text-[var(--t-muted)]">TEST-Beispiel mit Bildern und Nummern aus unserem aktuellen Kader.</p>:null}{rosterPlayers.length?<ul className="space-y-3">{rosterPlayers.map(player=><li key={player.name}><TournamentFanPlayerCard player={player} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl}/></li>)}</ul>:<p>Der Turnierkader ist noch nicht festgelegt.</p>}</section>:null}
        </>}
        <Link to={returnTo} className="block rounded-full bg-[var(--t-accent)] px-5 py-4 text-center text-lg font-bold text-white">Zum Turniercenter in der App</Link>
      </>}
    </main>
  </div>;
}
