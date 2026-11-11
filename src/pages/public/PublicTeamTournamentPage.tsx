import { TournamentFanFixture, FanTeamLogo } from '../../components/tournament/TournamentFanFixture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MapPin, Moon, Sun, Share2 } from 'lucide-react';
import {
  fetchPublicTeamTournamentPage,
  sharePublicTeamTournamentPage,
  type PublicTeamTournamentPageDto,
} from '../../lib/publicTeamTournament';
import { TournamentClubLogo } from '../../components/tournament/TournamentClubLogo';

export function PublicTeamTournamentPage(): React.ReactElement {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const location = useLocation();
  const candidate = (location.state as {returnTo?: unknown} | null)?.returnTo;
  const returnTo = typeof candidate === 'string' && /^\/(app|demo|manager)\//.test(candidate) ? candidate : `/app/events/${encodeURIComponent(publicId)}`;
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
  const fixtures = (page?.schedule ?? []).filter(m => tab !== 'final' || m.phase !== 'group');
  return <div className={`min-h-screen bg-[var(--t-bg)] text-[var(--t-text)]`} style={{
      '--t-accent': page?.accentColor ?? '#c82333',
      '--t-bg': theme === 'day' ? '#f7f8fa' : '#000000',
      '--t-surface': theme === 'day' ? '#ffffff' : '#0d0d10',
      '--t-text': theme === 'day' ? '#13151b' : '#ffffff',
      '--t-muted': theme === 'day' ? '#526071' : '#b5b5bc',
      '--t-border': theme === 'day' ? '#dce1e7' : '#ffffff24',
      '--t-fixture': theme === 'day' ? 'linear-gradient(135deg,#ffffff,#fff1f2)' : 'linear-gradient(135deg,#121114,#270e15)',
      '--t-warning': theme === 'day' ? '#854d0e' : '#fcd34d',
      colorScheme: theme === 'day' ? 'light' : 'dark',
    } as React.CSSProperties}>
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex flex-wrap items-center justify-between gap-3"><Link to={returnTo} className="rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-3 font-bold">← Zurück zum Turnier</Link><button onClick={()=>void onShare()} className="flex items-center gap-2 rounded-full border border-[var(--t-border)] px-4 py-3 font-bold"><Share2 size={18}/>Teilen</button></header>
      <div className="flex justify-end"><button type="button" onClick={toggleTheme} aria-label="Tag-/Nachtmodus wechseln" className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-4 font-bold">{theme === 'night' ? <Sun size={18}/> : <Moon size={18}/>} {theme === 'night' ? 'Tagmodus' : 'Nachtmodus'}</button></div>
      <p role="status" className="text-sm text-[var(--t-muted)]">{shareHint}</p>
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        <section className={card}><p className={heading}>SpielzeitApp · Turnierseite</p><div className="flex items-start gap-4"><TournamentClubLogo name={page.teamName} logoUrl={page.teamLogoUrl} size="lg"/><div className="min-w-0"><p className="text-sm text-[var(--t-muted)]">{[page.teamName,page.ageGroupLabel,page.seasonLabel].filter(Boolean).join(' · ')}</p><h1 className="mt-2 text-2xl font-extrabold leading-tight">{page.tournamentName}</h1><p className="mt-3 text-base text-[var(--t-muted)]">{page.dateLabel}</p><p className="mt-2 flex gap-2 text-base text-[var(--t-muted)]"><MapPin size={18} className="shrink-0 text-[var(--t-accent)]"/>{page.venue}</p></div></div><p className="mt-3 text-sm text-[var(--t-muted)]">{page.tournamentStatusLabel}{page.syncedAt ? ` · Aktualisiert ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}` : ''}</p></section>
        {error?<p role="status" className="text-[var(--t-warning)]">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        {page.allMatches.find(m => m.status === 'live') ? <section aria-label="Aktuelles Livespiel" aria-live="polite"><h2 className={heading}>Jetzt live</h2>{page.allMatches.filter(m => m.status === 'live').map(m => <TournamentFanFixture key={m.id} home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} homeGoals={m.scoreOur ?? 0} awayGoals={m.scoreOpp ?? 0} time={m.kickoffTimeLabel} phase={m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl}/>)}</section> : null}
        <nav aria-label="Turnierbereiche" className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-2">{[['ours','Unsere Spiele'],['games','Alle Spiele'],['tables','Tabellen'],['final','Finalrunde'],['scorers','Torschützen'],['roster','Unser Team']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-12 rounded-xl px-2 text-[15px] font-bold ${tab===id?'bg-[var(--t-accent)] text-white':'text-[var(--t-muted)]'}`}>{label}</button>)}</nav>
        {tab==='ours'?<><h2 className={heading}>Unsere Spiele</h2>{!page.allMatches.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:page.allMatches.map(m=><div key={m.id} className="space-y-2"><TournamentFanFixture home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} phase={m.phase==='group'?(m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Gruppenspiel'):m.phase==='unknown'?'Turnierspiel':'Platzierungsrunde'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/></div>)}</>:null}
        {tab==='tables'?<>{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-[var(--t-muted)]"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-[var(--t-border)]"><td className="py-3 font-bold">{r.rank}</td><td className="py-3 pr-2 font-semibold break-words"><span className="flex items-center gap-2">{<FanTeamLogo name={r.teamName} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>}{r.teamName}</span></td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}<p className="text-sm text-[var(--t-muted)]">Offizielle Veranstaltertabellen</p></>:null}
        {tab==='games'||tab==='final'?<><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Gesamter Spielplan'}</h2>{!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:fixtures.map((m,i)=><TournamentFanFixture key={m.id||i} home={m.homeTeam} away={m.awayTeam} homeGoals={m.homeGoals} awayGoals={m.awayGoals} time={m.time} phase={m.roundLabel ?? (m.phase==='group'?(m.groupLabel ? `Gruppe ${m.groupLabel}` : 'Gruppenspiel'):'Finalrunde')} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={m.homeTeam===page.ownParticipantName || m.awayTeam===page.ownParticipantName ? page.scorers?.filter(s=>s.time===m.time) : []}/>)}{tab==='final'&&page.finalRanking?.length?<section className={card}><h2 className={heading}>Endplatzierung</h2><ol className="space-y-3">{page.finalRanking.map(r=><li key={r.rank} className="flex gap-3 text-base"><b className="w-7 shrink-0">{r.rank}.</b><span>{r.teamName}</span></li>)}</ol></section>:null}</>:null}
        {tab==='scorers'?<section className={card}><h2 className={heading}>Unsere Torschützenliste</h2>{page.scorers?.some(s=>s.example)?<p className="mb-3 text-sm text-[var(--t-warning)]">TEST-Beispieldaten mit Namen aus unserem Kader – keine bestätigten historischen Torschützen.</p>:null}{page.scorers?.length?<ol className="space-y-3">{scorerTotals.map((s,i)=><li key={s.name} className="flex items-center justify-between gap-3 border-b border-[var(--t-border)] pb-3 text-base"><span>{i+1}. {s.name}</span><b>{s.goals} {s.goals===1?'Tor':'Tore'}</b></li>)}</ol>:<p>Noch keine Torschützen erfasst.</p>}</section>:null}
        {tab==='roster'?<section className={card}><h2 className={heading}>Unser Team · Fanansicht</h2><p className="mb-3 text-sm text-[var(--t-muted)]">TEST-Beispiel aus unserem Kader</p><ul className="space-y-3">{page.fanRoster?.map(name=><li key={name} className="flex items-center gap-3 text-base"><FanTeamLogo name={page.ownParticipantName || page.teamName} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>{name}</li>)}</ul></section>:null}
        <Link to={returnTo} className="block rounded-full bg-[var(--t-accent)] px-5 py-4 text-center text-lg font-bold text-white">Zum Turniercenter in der App</Link>
      </>}
    </main>
  </div>;
}
