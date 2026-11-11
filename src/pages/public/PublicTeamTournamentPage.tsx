import { TournamentFinalRanking } from '../../components/tournament/TournamentFinalRanking';
import { PublicTournamentMatchView, type PublicMatchView } from '../../components/tournament/PublicTournamentMatchView';
import { TournamentFanPlayerCard } from '../../components/tournament/TournamentFanPlayerCard';
import { TournamentFanFixture, FanTeamLogo } from '../../components/tournament/TournamentFanFixture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, Moon, Sun, Share2 } from 'lucide-react';
import {
  fetchPublicTeamTournamentPage,
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
    const timer = window.setInterval(refresh, 20_000);
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
  const heading = 'mb-3 text-[15px] font-extrabold uppercase tracking-[.14em] text-[var(--t-accent)]';
  const scorerTotals = Object.values((page?.scorers ?? []).reduce((all,s)=>{const row=all[s.name]??{name:s.name,goals:0};row.goals+=s.goals;all[s.name]=row;return all;},{} as Record<string,{name:string;goals:number}>)).sort((a,b)=>b.goals-a.goals);
  const profileFor = (name: string): PublicTournamentPlayer => page?.fanPlayers?.find(player => player.name === name) ?? {
    name, firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' '), number: null, imageUrl: null,
  };
  const rosterPlayers = (page?.fanRoster ?? []).map(profileFor).sort((a,b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name, 'de'));
  const selectedMatch = page?.allMatches.find(match => match.id === matchId);
  const fixtures = (page?.schedule ?? []).filter(m => tab !== 'final' || m.phase !== 'group');
  const renderScheduledFixture = (fixture: NonNullable<PublicTeamTournamentPageDto['schedule']>[number], index: number) => {
    if (!page) return null;
    const own = (fixture.homeTeam === page.ownParticipantName || fixture.awayTeam === page.ownParticipantName)
      ? page.allMatches.find(match => match.kickoffTimeLabel === fixture.time) : null;
    const content = <TournamentFanFixture home={fixture.homeTeam} away={fixture.awayTeam} homeGoals={fixture.homeGoals} awayGoals={fixture.awayGoals} time={fixture.time} phase={fixture.roundLabel ?? (fixture.phase === 'group' ? (fixture.groupLabel ? `Gruppe ${fixture.groupLabel}` : 'Gruppenspiel') : 'Finalrunde')} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={own ? page.scorers?.filter(s => s.time === fixture.time) : []}/>;
    return own ? <Link key={fixture.id || index} to={`?spiel=${encodeURIComponent(own.id)}`} className="block rounded-2xl" aria-label={`${own.opponentName} · Zum Spiel, Aufstellung und Spielverlauf`}>{content}<p className="px-2 pt-2 text-right text-sm font-bold text-[var(--t-accent)]">Zum Spiel →</p></Link> : <React.Fragment key={fixture.id || index}>{content}</React.Fragment>;
  };
  return <div data-theme={theme} className={`public-tournament-page bg-[var(--t-bg)] text-[var(--t-text)]`} style={{
      '--t-accent': page?.accentColor ?? '#c82333',
      '--t-bg': theme === 'day' ? '#f7f8fa' : '#000000',
      '--t-surface': theme === 'day' ? '#ffffff' : '#0d0d10',
      '--t-text': theme === 'day' ? '#13151b' : '#ffffff',
      '--t-muted': theme === 'day' ? '#526071' : '#b5b5bc',
      '--t-border': theme === 'day' ? 'color-mix(in srgb, var(--t-accent) 18%, transparent)' : 'color-mix(in srgb, var(--t-accent) 28%, transparent)',
      '--t-fixture': theme === 'day' ? 'linear-gradient(135deg,#ffffff,#fff1f2)' : 'linear-gradient(135deg,#121114,#270e15)',
      '--t-player-badge': theme === 'day' ? '#f1f5f9' : 'rgba(0,0,0,.25)',
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
      <p role="status" className="text-sm text-[var(--t-muted)]">{shareHint}</p>
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        {selectedMatch ? <PublicTournamentMatchView page={page} match={selectedMatch} view={matchView} onView={view=>setSearchParams({spiel:selectedMatch.id,ansicht:view})}/> : <>
        <section className={card}><p className={heading}>SpielzeitApp · Turnierseite</p><div className="flex items-start gap-4"><TournamentClubLogo name={page.teamName} logoUrl={page.teamLogoUrl} size="lg"/><div className="min-w-0"><p className="text-sm text-[var(--t-muted)]">{[page.teamName,page.ageGroupLabel,page.seasonLabel].filter(Boolean).join(' · ')}</p><h1 className="mt-2 text-2xl font-extrabold leading-tight">{page.tournamentName}</h1><p className="mt-3 text-base text-[var(--t-muted)]">{page.dateLabel}</p><p className="mt-2 flex gap-2 text-base text-[var(--t-muted)]"><MapPin size={18} className="shrink-0 text-[var(--t-accent)]"/>{page.venue}</p></div></div><p className="mt-3 text-sm text-[var(--t-muted)]">{page.tournamentStatusLabel}{page.syncedAt ? ` · Aktualisiert ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}` : ''}</p></section>
        {error?<p role="status" className="text-[var(--t-warning)]">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        {page.allMatches.find(m => m.status === 'live') ? <section aria-label="Aktuelles Livespiel" aria-live="polite"><h2 className={heading}>Jetzt live</h2>{page.allMatches.filter(m => m.status === 'live').map(m => <TournamentFanFixture key={m.id} home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} homeGoals={m.scoreOur ?? 0} awayGoals={m.scoreOpp ?? 0} time={m.kickoffTimeLabel} phase={m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl}/>)}</section> : null}
        <nav aria-label="Turnierbereiche" className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-2">{[['ours','Unsere Spiele'],['games','Alle Spiele'],['tables','Tabellen'],['final','Finalrunde'],['scorers','Torschützen'],['roster','Unser Team']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-12 rounded-xl px-2 text-[15px] font-bold ${tab===id?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label}</button>)}</nav>
        {tab==='ours'?<><h2 className={heading}>Unsere Spiele</h2>{!page.allMatches.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:page.allMatches.map(m=><Link key={m.id} to={`?spiel=${encodeURIComponent(m.id)}`} className="block space-y-2 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]" aria-label={`${m.opponentName} · Zum Spiel, Aufstellung und Spielverlauf`}><TournamentFanFixture home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} phase={m.phase==='group'?(m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Gruppenspiel'):m.phase==='unknown'?'Turnierspiel':'Platzierungsrunde'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/><p className="px-2 pb-2 text-right text-sm font-bold text-[var(--t-accent)]">Zum Spiel · Aufstellung & Spielverlauf →</p></Link>)}</>:null}
        {tab==='tables'?<>{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-[var(--t-muted)]"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-[var(--t-border)]"><td className="py-3 font-bold">{r.rank}</td><td className="py-3 pr-2 font-semibold break-words"><span className="flex items-center gap-2">{<FanTeamLogo name={r.teamName} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>}{r.teamName}</span></td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}<p className="text-sm text-[var(--t-muted)]">Offizielle Veranstaltertabellen</p></>:null}
        {tab==='games'||tab==='final'?<><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Gesamter Spielplan'}</h2>{!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:fixtures.map(renderScheduledFixture)}{tab==='final'&&page.finalRanking?.length?<TournamentFinalRanking ranking={page.finalRanking} logos={page.teamLogos} ownName={page.ownParticipantName || page.teamName} ownLogo={page.teamLogoUrl}/>:null}</>:null}
        {tab==='scorers'?<section className={card}><h2 className={heading}>Unsere Torschützenliste</h2>{page.scorers?.some(s=>s.example)?<p className="mb-3 text-sm text-[var(--t-warning)]">TEST-Beispieldaten aus unserem Kader – keine bestätigten historischen Torschützen.</p>:null}{scorerTotals.length?<ol className="space-y-3">{scorerTotals.map((s,i)=><li key={s.name}><TournamentFanPlayerCard player={profileFor(s.name)} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl} goals={s.goals} rank={i+1}/></li>)}</ol>:<p>Noch keine Torschützen erfasst.</p>}</section>:null}
        {tab==='roster'?<section className={card}><h2 className={heading}>Unser Team</h2>{page.fanRosterExample?<p className="mb-3 text-sm text-[var(--t-muted)]">TEST-Beispiel mit Bildern und Nummern aus unserem aktuellen Kader.</p>:null}{rosterPlayers.length?<ul className="space-y-3">{rosterPlayers.map(player=><li key={player.name}><TournamentFanPlayerCard player={player} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl}/></li>)}</ul>:<p>Der Turnierkader ist noch nicht festgelegt.</p>}</section>:null}
        </>}
        <Link to={returnTo} className="block rounded-full bg-[var(--t-accent)] px-5 py-4 text-center text-lg font-bold text-white">Zum Turniercenter in der App</Link>
      </>}
    </main>
  </div>;
}
