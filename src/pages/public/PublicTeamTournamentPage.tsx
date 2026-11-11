import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MapPin, Radio, RefreshCw, Share2 } from 'lucide-react';
import {
  fetchPublicTeamTournamentPage,
  sharePublicTeamTournamentPage,
  type PublicTeamTournamentMatchDto,
  type PublicTeamTournamentPageDto,
} from '../../lib/publicTeamTournament';
import { getOurTeamLogoUrl } from '../../lib/teamLogos';
import { TournamentClubLogo } from '../../components/tournament/TournamentClubLogo';

function TeamMark({
  name,
  logoUrl,
  highlight,
  size = 'regular',
}: {
  name: string;
  logoUrl?: string | null;
  highlight?: boolean;
  size?: 'featured' | 'regular';
}) {
  const featured = size === 'featured';
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center text-center ${
        featured ? 'gap-2.5' : 'gap-2'
      }`}
    >
      <TournamentClubLogo
        name={name}
        logoUrl={logoUrl}
        size={featured ? 'xl' : 'lg'}
        tone="light"
      />
      <p
        className={`line-clamp-2 font-semibold leading-snug ${
          featured ? 'text-[13px] sm:text-[14px]' : 'text-[12px] sm:text-[13px]'
        } ${highlight ? 'text-slate-950' : 'text-slate-700'}`}
      >
        {name}
      </p>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: PublicTeamTournamentMatchDto['status'] | PublicTeamTournamentPageDto['tournamentStatus'];
  label: string;
}) {
  const cls =
    status === 'live'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'finished'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : status === 'canceled'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-white text-slate-600';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {status === 'live' ? <Radio className="h-3 w-3" aria-hidden /> : null}
      {label}
    </span>
  );
}

function MatchCard({
  match,
  featured,
  ourLogoUrl,
}: {
  match: PublicTeamTournamentMatchDto;
  featured?: boolean;
  ourLogoUrl: string | null;
}) {
  const scoreReady = match.scoreOur != null && match.scoreOpp != null;
  const markSize = featured ? 'featured' : 'regular';
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 ${
        featured
          ? 'border-red-200 shadow-[0_8px_28px_rgba(220,38,38,0.08)]'
          : 'border-slate-200/90'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {featured ? (
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
              Nächstes Spiel
            </span>
          ) : null}
          <StatusPill status={match.status} label={match.statusLabel} />
        </div>
        <p
          className={`font-bold tabular-nums leading-none text-slate-950 ${
            featured ? 'text-[26px] sm:text-[30px]' : 'text-[24px] sm:text-[28px]'
          }`}
        >
          {match.kickoffTimeLabel}
        </p>
      </div>

      <div className={`flex items-start ${featured ? 'gap-2.5 sm:gap-3.5' : 'gap-2 sm:gap-3'}`}>
        <TeamMark
          name={match.homeName}
          logoUrl={match.ourIsHome ? ourLogoUrl : undefined}
          highlight={match.ourIsHome}
          size={markSize}
        />
        <div
          className={`flex shrink-0 flex-col items-center justify-center ${
            featured ? 'w-[4.25rem] pt-5 sm:w-20 sm:pt-6' : 'w-14 pt-4 sm:w-16 sm:pt-5'
          }`}
        >
          {scoreReady ? (
            <p
              className={`font-bold tabular-nums text-slate-950 ${
                featured ? 'text-[26px] sm:text-[30px]' : 'text-[22px] sm:text-[26px]'
              }`}
            >
              {match.scoreOur}:{match.scoreOpp}
            </p>
          ) : (
            <p className={`font-semibold text-slate-300 ${featured ? 'text-[18px]' : 'text-[16px]'}`}>
              vs
            </p>
          )}
        </div>
        <TeamMark
          name={match.awayName}
          logoUrl={!match.ourIsHome ? ourLogoUrl : undefined}
          highlight={!match.ourIsHome}
          size={markSize}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {match.pitch ? <span>Platz: {match.pitch}</span> : null}
        {match.groupLabel ? <span>Gruppe {match.groupLabel}</span> : null}
        {match.phase && match.phase !== 'group' && match.phase !== 'unknown' ? (
          <span className="capitalize">{match.phase}</span>
        ) : null}
      </div>
    </article>
  );
}

function ResultRow({ match, ourLogoUrl }: { match: PublicTeamTournamentMatchDto; ourLogoUrl: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-3">
      <div className="w-14 shrink-0 text-center">
        <p className="text-[18px] font-bold tabular-nums text-slate-900">{match.kickoffTimeLabel}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TournamentClubLogo name={match.ourTeamName} logoUrl={ourLogoUrl} size="sm" tone="light" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{match.ourTeamName}</p>
          <p className="line-clamp-2 text-[13px] leading-snug text-slate-600">{match.opponentName}</p>
        </div>
      </div>
      <p className="shrink-0 text-[20px] font-bold tabular-nums text-slate-950">
        {match.scoreOur ?? 0}:{match.scoreOpp ?? 0}
      </p>
    </li>
  );
}

export function PublicTeamTournamentPage(): React.ReactElement {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const location = useLocation();
  const candidate = (location.state as {returnTo?: unknown} | null)?.returnTo;
  const returnTo = typeof candidate === 'string' && /^\/(app|demo|manager)\//.test(candidate) ? candidate : `/app/events/${encodeURIComponent(publicId)}`;
  const requestId = useRef(0);
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
    if (result.page || !silent) setPage(result.page);
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

  const ourLogo = page?.teamLogoUrl || getOurTeamLogoUrl();

  const card = 'rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#151215,#09090d)] p-4';
  const [tab, setTab] = useState('ours');
  const heading = 'mb-3 text-[15px] font-extrabold uppercase tracking-[.14em] text-[var(--t-accent)]';
  const fixtures = (page?.schedule ?? []).filter(m => tab !== 'final' || m.phase !== 'group');
  return <div className="min-h-screen bg-[#070708] text-white" style={{'--t-accent':page?.accentColor ?? '#c82333'} as React.CSSProperties}>
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex flex-wrap items-center justify-between gap-3"><Link to={returnTo} className="rounded-full border border-white/15 bg-white/5 px-4 py-3 font-bold">← Zurück zum Turnier</Link><button onClick={()=>void onShare()} className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 font-bold"><Share2 size={18}/>Teilen</button></header>
      <p role="status" className="text-sm text-white/60">{shareHint}</p>
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        <section className={card}><p className={heading}>SpielzeitApp · Turnier</p><div className="flex items-start gap-4"><TournamentClubLogo name={page.teamName} logoUrl={page.teamLogoUrl} size="lg"/><div className="min-w-0"><p className="text-sm text-white/60">{[page.teamName,page.ageGroupLabel,page.seasonLabel].filter(Boolean).join(' · ')}</p><h1 className="mt-2 text-2xl font-extrabold leading-tight">{page.tournamentName}</h1><p className="mt-3 text-base text-white/70">{page.dateLabel}</p><p className="mt-2 flex gap-2 text-base text-white/70"><MapPin size={18} className="shrink-0 text-[var(--t-accent)]"/>{page.venue}</p></div></div><p className="mt-3 text-sm text-white/50">{page.tournamentStatusLabel}{page.syncedAt ? ` · Aktualisiert ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}` : ''}</p></section>
        {error?<p role="status" className="text-amber-300">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        <nav aria-label="Turnierbereiche" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2">{[['ours','Unsere Spiele'],['games','Alle Spiele'],['tables','Tabellen'],['final','Finalrunde']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-12 rounded-xl px-2 text-[15px] font-bold ${tab===id?'bg-[var(--t-accent)] text-white':'text-white/65'}`}>{label}</button>)}</nav>
        {tab==='ours'?<><h2 className={heading}>Unsere Spiele</h2>{!page.allMatches.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:page.allMatches.map(m=><article className={card} key={m.id}><div className="flex justify-between gap-3"><p className="text-base font-bold tabular-nums">{m.kickoffTimeLabel}</p><p className="text-sm text-white/60">{m.statusLabel}</p></div><div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0 space-y-2 text-base font-semibold"><p>{m.ourTeamName}</p><p className="text-white/65">{m.opponentName}</p></div><p className="text-3xl font-extrabold tabular-nums">{m.scoreOur!=null?`${m.scoreOur}:${m.scoreOpp}`:'–'}</p></div><p className="mt-3 text-sm text-white/50">{m.phase==='group'?`Gruppe ${m.groupLabel ?? ''}`:m.phase==='final'?'Finale':m.phase==='semifinal'?'Halbfinale':'Platzierungsrunde'}{m.pitch?` · ${m.pitch}`:''}</p></article>)}</>:null}
        {tab==='tables'?<>{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-white/50"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-white/10"><td className="py-3 font-bold">{r.rank}</td><td className="py-3 pr-2 font-semibold break-words">{r.teamName}</td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}<p className="text-sm text-white/50">Offizielle Veranstaltertabellen</p></>:null}
        {tab==='games'||tab==='final'?<><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Gesamter Spielplan'}</h2>{!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:fixtures.map((m,i)=><article className={card} key={m.id||i}><p className="mb-3 text-sm text-white/55">{m.time} · {m.roundLabel ?? (m.phase==='group'?`Gruppe ${m.groupLabel}`:m.phase==='semifinal'?'Halbfinale':'Platzierungsrunde')}</p><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="space-y-2 text-base font-semibold"><p>{m.homeTeam}</p><p className="text-white/65">{m.awayTeam}</p></div><p className="text-2xl font-extrabold">{m.homeGoals!=null?`${m.homeGoals}:${m.awayGoals}`:'–'}</p></div></article>)}{tab==='final'&&page.finalRanking?.length?<section className={card}><h2 className={heading}>Endplatzierung</h2><ol className="space-y-3">{page.finalRanking.map(r=><li key={r.rank} className="flex gap-3 text-base"><b className="w-7 shrink-0">{r.rank}.</b><span>{r.teamName}</span></li>)}</ol></section>:null}</>:null}
        <Link to={returnTo} className="block rounded-full bg-[var(--t-accent)] px-5 py-4 text-center text-lg font-bold">Zum Turniercenter in der App</Link>
      </>}
    </main>
  </div>;
}
