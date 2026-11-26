import {useTournamentScreenAccess, TournamentScreenManagers} from '../../components/tournament/TournamentScreenAccess';
import {TournamentPresentation, TournamentPresentationTools} from '../../components/tournament/TournamentPresentation';
import { TournamentFinalRanking } from '../../components/tournament/TournamentFinalRanking';
import { PublicTournamentMatchView, type PublicMatchView } from '../../components/tournament/PublicTournamentMatchView';
import { TournamentFanPlayerCard } from '../../components/tournament/TournamentFanPlayerCard';
import { TournamentFanFixture, FanTeamLogo } from '../../components/tournament/TournamentFanFixture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, Moon, Play, Sun, Share2 } from 'lucide-react';
import { tournamentLivestreamEmbedUrl, tournamentLivestreamUrl } from '../../../server/lib/tournamentLivestream.js';
import {
  fetchPublicTeamTournamentPage,
  groupPublicTournamentMatches,
  pickPublicTournamentGroupMatch,
  sharePublicTeamTournamentPage,
  type PublicTeamTournamentPageDto,
  type PublicTournamentPlayer,
  type PublicTournamentScheduleFixture,
} from '../../lib/publicTeamTournament';
import { mutedAccentOnLight, normalizeBrandColor, readableTextColor } from '../../lib/clubBranding';
import { dsMatchdaySectionLabelClass } from '../../lib/premiumDesignSystem';
import { TournamentClubLogo } from '../../components/tournament/TournamentClubLogo';
import '../../features/club/marketSplash.css';

const NEXT_PRO_U12_2026_ID = '42bf98e7-1047-4580-bddb-561457821562';

function NextProIntro({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumTimeElapsed(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const fading = ready && minimumTimeElapsed;
  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(onFinished, 200);
    return () => window.clearTimeout(timer);
  }, [fading, onFinished]);

  return (
    <div data-nextpro-intro aria-hidden="true"
      className={`market-splash pointer-events-none transition-opacity duration-200 motion-reduce:transition-none ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <img src="/icons/turniere-180.png" alt="" width="130" height="130" fetchPriority="high" className="object-contain" />
      <h1>NextPro Hallencup</h1>
      <p>U12 · Sporthalle Wilhelmsburg</p>
      <div className="market-splash-track" />
      <small>powered by SpielzeitApp</small>
    </div>
  );
}

function compareFixtureKickoff(
  a: { kickoffAt?: string | null; time: string },
  b: { kickoffAt?: string | null; time: string },
) {
  const difference = Date.parse(a.kickoffAt ?? '') - Date.parse(b.kickoffAt ?? '');
  return Number.isFinite(difference) ? difference : a.time.localeCompare(b.time);
}

function PublicKickoffCountdown({ kickoffAt }: { kickoffAt: string }) {
  const [now, setNow] = useState(Date.now);
  const remaining = Math.ceil((Date.parse(kickoffAt) - now) / 1000);

  useEffect(() => {
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const totalHours = Math.floor(remaining / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  const countdown = days > 0
    ? `${days} ${days === 1 ? 'Tag' : 'Tage'}${hours ? ` ${hours} Std.` : ''}`
    : `${hours ? `${hours}:` : ''}${minutes}:${seconds}`;
  return (
    <div role="timer" className="tournament-kickoff-countdown flex items-center justify-center gap-2 border-t border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5">
      <span className="text-sm font-semibold text-[var(--t-muted)]">Anpfiff in</span>
      <span className="text-xl font-extrabold tabular-nums text-[var(--t-accent)]">{countdown}</span>
    </div>
  );
}

export function PublicTeamTournamentPage({publicIdOverride,embedded=false}:{publicIdOverride?:string;embedded?:boolean} = {}): React.ReactElement {
  const { publicId: routePublicId = '' } = useParams<{ publicId: string }>();
  const publicId=publicIdOverride ?? routePublicId;
  const {access:screenAccess,refresh:refreshScreenAccess}=useTournamentScreenAccess(publicId);
  const location = useLocation();
  const candidate = (location.state as {returnTo?: unknown} | null)?.returnTo;
  const appReturnTo = typeof candidate === 'string' && /^\/(app|demo|manager)\//.test(candidate) ? candidate : null;
  const returnTo = appReturnTo ?? `/app/events/${encodeURIComponent(publicId)}`;
  const returnsToLive = /^\/(app|demo)\/live(?:[/?]|$)/.test(returnTo);
  const [searchParams, setSearchParams] = useSearchParams();
  const matchId = searchParams.get('spiel');
  const isNextProOverview = !embedded && !matchId && publicId === NEXT_PRO_U12_2026_ID;
  const [showIntro, setShowIntro] = useState(() => isNextProOverview && !location.hash && searchParams.size === 0);
  const finishIntro = useCallback(() => setShowIntro(false), []);
  const viewRaw = searchParams.get('ansicht');
  const matchView: PublicMatchView = viewRaw === 'formation' || viewRaw === 'ticker' || viewRaw === 'stats' ? viewRaw : 'overview';
  const activeRequest = useRef<AbortController | null>(null);
  const scrollSurface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollSurface.current?.scrollTo({ top: 0 });
  }, [publicId, matchId]);
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    if (embedded) return 'night';
    try { return localStorage.getItem('sz:public-tournament-theme:v2') === 'night' ? 'night' : 'day'; }
    catch { return 'day'; }
  });
  useEffect(() => {
    if (embedded) return;
    try { localStorage.setItem('sz:public-tournament-theme:v2', theme); } catch { /* optional preference */ }
  }, [theme,embedded]);
  const toggleTheme = () => setTheme(current => current === 'night' ? 'day' : 'night');
  const [page, setPage] = useState<PublicTeamTournamentPageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openedStream, setOpenedStream] = useState<{ publicId: string; url: string | null } | null>(null);
  const livestreamSection = useRef<HTMLElement>(null);
  const tickerSection = useRef<HTMLElement>(null);
  const tournamentNavigation = useRef<HTMLElement>(null);
  const livestreamUrl = tournamentLivestreamUrl(page?.livestreamUrl);
  const recording = page?.livestreamIsRecording ?? page?.tournamentStatus === 'finished';
  const recordingParts = recording && page?.recordingParts?.length ? page.recordingParts : [];
  const streamLabel = recording ? 'Aufzeichnung ansehen' : 'Livestream ansehen';
  const playerChoice = openedStream?.publicId === publicId ? openedStream : null;
  const chosenVideo = playerChoice?.url ?? null;
  const explicitlyOpened = Boolean(chosenVideo && (
    recordingParts.length ? recordingParts.includes(chosenVideo) : chosenVideo === livestreamUrl
  ));
  const defaultPreview = recording && !playerChoice ? (recordingParts[0] ?? livestreamUrl) : null;
  const selectedVideo = explicitlyOpened ? chosenVideo : defaultPreview;
  const embedUrl = tournamentLivestreamEmbedUrl(selectedVideo, { autoplay: explicitlyOpened });
  const playerOpen = Boolean(embedUrl);
  const canOpenPlayer = Boolean(tournamentLivestreamEmbedUrl(livestreamUrl));
  useEffect(() => {
    setOpenedStream(null);
  }, [publicId, livestreamUrl]);
  useEffect(() => {
    if (location.hash === '#livestream' && !loading && !matchId) {
      livestreamSection.current?.scrollIntoView({ block: 'start' });
    }
  }, [location.key, location.hash, livestreamUrl, loading, matchId]);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (activeRequest.current) return;
    const request = new AbortController();
    activeRequest.current = request;
    if (!silent) setLoading(true);
    setError(null);
    const timeout = window.setTimeout(() => request.abort(), 20_000);
    const result = await fetchPublicTeamTournamentPage(publicId, request.signal).finally(() => window.clearTimeout(timeout));
    if (request !== activeRequest.current) return;
    activeRequest.current = null;
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
      activeRequest.current?.abort();
      activeRequest.current = null;
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
  const [tab, setTab] = useState(() => searchParams.get('bereich') === 'spielplan' ? 'games' : 'ours');
  const [scheduleView,setScheduleView]=useState<'upcoming'|'results'>('upcoming');
  const nextMatchHeading = <h2 className={`mb-2 ${dsMatchdaySectionLabelClass()}`}>Nächstes Spiel</h2>;
  const heading = 'public-tournament-heading mb-3 text-[15px] font-extrabold uppercase tracking-[.14em] text-[var(--t-accent)]';
  const scorerTotals = Object.values((page?.scorers ?? []).reduce((all,s)=>{const row=all[s.name]??{name:s.name,goals:0};row.goals+=s.goals;all[s.name]=row;return all;},{} as Record<string,{name:string;goals:number}>)).sort((a,b)=>b.goals-a.goals);
  const profileFor = (name: string): PublicTournamentPlayer => page?.fanPlayers?.find(player => player.name === name) ?? {
    name, firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' '), number: null, imageUrl: null,
  };
  const rosterPlayers = (page?.fanRoster ?? []).map(profileFor).sort((a,b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name, 'de'));
  const selectedMatch = page?.allMatches.find(match => match.id === matchId);
  const groupedMatches = groupPublicTournamentMatches(page?.allMatches ?? []);
  const now = Date.now();
  const ownLive = groupedMatches.live[0];
  const nextOwn = groupedMatches.upcoming.find(match => Date.parse(match.kickoffAt) > now);
  const schedule = page?.schedule ?? [];
  const finalRanking = page?.finalRanking?.length ? (
    <TournamentFinalRanking ranking={page.finalRanking} logos={page.teamLogos}
      ownName={page.ownParticipantName || page.teamName} ownLogo={page.teamLogoUrl}
      inProgress={schedule.some(match => match.phase !== 'group' && (match.status === 'live' || match.status === 'upcoming'))} />
  ) : null;
  const isOwnScheduleFixture = (fixture: PublicTournamentScheduleFixture) =>
    Boolean(page?.ownParticipantName && [
      fixture.homeProjection ?? fixture.homeTeam,
      fixture.awayProjection ?? fixture.awayTeam,
    ].includes(page.ownParticipantName));
  const ownMatchForFixture = (fixture: PublicTournamentScheduleFixture) => {
    if (!page || !isOwnScheduleFixture(fixture)) return undefined;
    return page.allMatches.find(match => fixture.kickoffAt
      ? match.kickoffAt === fixture.kickoffAt || Date.parse(match.kickoffAt) === Date.parse(fixture.kickoffAt)
      : match.kickoffTimeLabel === fixture.time);
  };
  const unlinkedOwnFixtures = tab === 'ours' ? schedule.filter(fixture =>
    isOwnScheduleFixture(fixture) && !ownMatchForFixture(fixture) && fixture.status !== 'canceled',
  ) : [];
  const ownScheduledResults = unlinkedOwnFixtures.filter(fixture =>
    fixture.status === 'finished' || (fixture.homeGoals != null && fixture.awayGoals != null),
  );
  const ownScheduledOpen = unlinkedOwnFixtures.filter(fixture => !ownScheduledResults.includes(fixture));
  const isWithinScheduledMatch = (fixture: PublicTournamentScheduleFixture) => {
    const kickoff = Date.parse(fixture.kickoffAt ?? '');
    return kickoff <= now && now < kickoff + (fixture.plannedMinutes ?? 0) * 60_000;
  };
  const nextScheduledOwn = [...ownScheduledOpen]
    .sort(compareFixtureKickoff)
    .find(fixture => Date.parse(fixture.kickoffAt ?? '') > now);
  const featuredOwnFixture = ownLive ? undefined : ownScheduledOpen.find(fixture => fixture.status === 'live') ??
    ownScheduledOpen.find(isWithinScheduledMatch) ??
    (nextScheduledOwn && (!nextOwn || Date.parse(nextScheduledOwn.kickoffAt ?? '') < Date.parse(nextOwn.kickoffAt))
      ? nextScheduledOwn : undefined);
  const featuredFixtureIsCurrent = featuredOwnFixture && (featuredOwnFixture.status === 'live' || isWithinScheduledMatch(featuredOwnFixture));
  const featuredMatch = tab === 'ours' && !featuredOwnFixture ? ownLive ?? nextOwn : undefined;
  const externalLiveFixtures = tab === 'games' ? schedule.filter(fixture => {
    if (fixture.status !== 'live') return false;
    const own = ownMatchForFixture(fixture);
    return !own || own.status === 'upcoming';
  }) : [];
  const hasLiveGames = tab === 'games' && (groupedMatches.live.length > 0 || externalLiveFixtures.length > 0);
  const groupHighlight = tab === 'games' && page && !hasLiveGames ? pickPublicTournamentGroupMatch(page, now) : null;
  const currentGroupFixture = groupHighlight?.fixture;
  const highlightedOwnMatch = currentGroupFixture && page?.ownParticipantName &&
    (currentGroupFixture.homeTeam === page.ownParticipantName || currentGroupFixture.awayTeam === page.ownParticipantName)
    ? groupedMatches.upcoming.find(match => match.kickoffTimeLabel === currentGroupFixture.time)
    : undefined;
  const renderOwnCard = (m: PublicTeamTournamentPageDto['allMatches'][number], prominent = false) => page ? (
    <Link key={m.id} to={`?spiel=${encodeURIComponent(m.id)}`} className="tournament-fixture-frame block overflow-hidden rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]" aria-label={`${m.kickoffTimeLabel} · ${m.opponentName} · Zum Spiel`}>
      <TournamentFanFixture prominent={prominent} kickoffLabel={embedded ? 'Anpfiff' : undefined} home={page.ownParticipantName || m.ourTeamName} away={m.opponentName} status={m.status} clock={page.matchDetails?.find(d=>d.id===m.id)} homeGoals={m.scoreOur} awayGoals={m.scoreOpp} time={m.kickoffTimeLabel} phase={m.groupLabel?`Gruppe ${m.groupLabel}`:'Turnierspiel'} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} scorers={page.scorers?.filter(s=>s.time===m.kickoffTimeLabel)}/>
      {prominent && m.status === 'upcoming' ? <PublicKickoffCountdown key={m.kickoffAt} kickoffAt={m.kickoffAt} /> : null}
      <p className="border-t border-[var(--t-border)] px-4 py-3 text-sm font-bold text-[var(--t-accent)]">{m.status==='finished'?'Spielverlauf öffnen':'Zum Spiel'} →</p>
    </Link>
  ) : null;
  const fixtures = schedule.filter(m => m !== currentGroupFixture && !externalLiveFixtures.includes(m) &&
    !(tab === 'games' && ownMatchForFixture(m)?.status === 'live') && (tab !== 'final' || m.phase !== 'group') &&
    !(featuredMatch?.kickoffTimeLabel === m.time && (m.homeTeam === page?.ownParticipantName || m.awayTeam === page?.ownParticipantName)));
  const scheduleFinished = (fixture: NonNullable<PublicTeamTournamentPageDto['schedule']>[number]) => {
    const own = ownMatchForFixture(fixture);
    return own ? own.status==='finished' : fixture.homeGoals!=null && fixture.awayGoals!=null;
  };
  const scheduledUpcoming = fixtures.filter(m=>!scheduleFinished(m)).sort(compareFixtureKickoff);
  const scheduledResults = fixtures.filter(scheduleFinished).sort((a,b)=>b.time.localeCompare(a.time));
  const renderScheduledFixture = (fixture: NonNullable<PublicTeamTournamentPageDto['schedule']>[number], index: number) => {
    if (!page) return null;
    const own = ownMatchForFixture(fixture);
    const ownHome = (fixture.homeProjection ?? fixture.homeTeam) === page.ownParticipantName;
    const isFeatured = fixture === featuredOwnFixture;
    const status = own?.status === 'live' || own?.status === 'finished' ? own.status
      : isFeatured && fixture.status !== 'live' && isWithinScheduledMatch(fixture) ? 'scheduled-live' : fixture.status;
    const ownScore = own && (own.status === 'live' || own.status === 'finished');
    const hg = ownScore ? (ownHome ? own.scoreOur : own.scoreOpp) : status === 'live' ? fixture.liveHomeGoals ?? null : fixture.homeGoals;
    const ag = ownScore ? (ownHome ? own.scoreOpp : own.scoreOur) : status === 'live' ? fixture.liveAwayGoals ?? null : fixture.awayGoals;
    const provisional = fixture.phase !== 'group' && Boolean(fixture.homeProjection || fixture.awayProjection);
    const phaseLabel = fixture.roundLabel || (fixture.groupLabel ? `Gruppe ${fixture.groupLabel}`
      : fixture.phase === 'semifinal' ? 'Halbfinale' : fixture.phase === 'placement' ? 'Platzierungsspiel' : 'Turnierspiel');
    const content = <>
      <TournamentFanFixture
        prominent={isFeatured || externalLiveFixtures.includes(fixture)}
        kickoffLabel={embedded ? 'Anpfiff' : undefined}
        home={fixture.homeProjection ?? fixture.homeTeam}
        away={fixture.awayProjection ?? fixture.awayTeam}
        homeGoals={hg}
        awayGoals={ag}
        status={status}
        officialDecision={fixture.resultDecision}
        time={fixture.time}
        phase={phaseLabel}
        logos={page.teamLogos}
        ownName={page.ownParticipantName}
        ownLogo={page.teamLogoUrl}
        scorers={own ? page.scorers?.filter(s=>s.time===fixture.time) : []}
      />
      {provisional ? (
        <p className="px-2 pt-2 text-xs font-semibold text-[var(--t-muted)]">
          Vorläufig · {fixture.homeTeam} gegen {fixture.awayTeam}
        </p>
      ) : null}
      {isFeatured && status === 'upcoming' && fixture.kickoffAt ? (
        <PublicKickoffCountdown key={fixture.kickoffAt} kickoffAt={fixture.kickoffAt} />
      ) : null}
    </>;
    const frame = embedded && (own || isFeatured)
      ? 'tournament-fixture-frame overflow-hidden rounded-2xl border'
      : '';
    return own ? <Link key={fixture.id || index} to={`?spiel=${encodeURIComponent(own.id)}`} className={`block ${frame || 'rounded-xl'}`} aria-label={`${own.opponentName} · Zum Spiel, Aufstellung und Spielverlauf`}>{content}{embedded ? <p className="border-t border-[var(--t-border)] px-4 py-3 text-sm font-bold text-[var(--t-accent)]">{status === 'finished' ? 'Spielverlauf öffnen' : 'Zum Spiel'} →</p> : null}</Link>
      : frame ? <div key={fixture.id || index} className={frame}>{content}</div>
      : <React.Fragment key={fixture.id || index}>{content}</React.Fragment>;

  };
  const liveGameCards = hasLiveGames ? [
    ...groupedMatches.live.map(match => ({ time: match.kickoffTimeLabel, card: renderOwnCard(match, true) })),
    ...externalLiveFixtures.map((fixture, index) => ({ time: fixture.time, card: renderScheduledFixture(fixture, index) })),
  ].sort((a, b) => a.time.localeCompare(b.time)) : [];
  const remainingOwnCards = tab === 'ours' ? [
    ...groupedMatches.upcoming.filter(match => match !== featuredMatch)
      .map(match => ({ kickoffAt: match.kickoffAt, time: match.kickoffTimeLabel, card: renderOwnCard(match) })),
    ...ownScheduledOpen.filter(fixture => fixture !== featuredOwnFixture)
      .map((fixture, index) => ({ kickoffAt: fixture.kickoffAt, time: fixture.time, card: renderScheduledFixture(fixture, index) })),
  ].sort(compareFixtureKickoff) : [];
  const ownResultCards = tab === 'ours' ? [
    ...groupedMatches.results.map(match => ({ kickoffAt: match.kickoffAt, time: match.kickoffTimeLabel, card: renderOwnCard(match) })),
    ...ownScheduledResults.map((fixture, index) => ({ kickoffAt: fixture.kickoffAt, time: fixture.time, card: renderScheduledFixture(fixture, index) })),
  ].sort((a, b) => compareFixtureKickoff(b, a)) : [];
  const ticker = page ? (
    <section ref={tickerSection} className="scroll-mt-4 space-y-4">
      <h2 className={heading}>Unser Turnier-Liveticker</h2>
      {groupedMatches.live.map(match => (
        <PublicTournamentMatchView key={match.id} timelineOnly page={page} match={match} view="ticker"
          onView={view => setSearchParams({ spiel: match.id, ansicht: view })} />
      ))}
      {groupedMatches.results.map(match => (
        <details key={match.id} className="tournament-fixture-frame overflow-hidden rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)]">
          <summary className="cursor-pointer list-none">
            <TournamentFanFixture
              home={page.ownParticipantName || match.ourTeamName} away={match.opponentName}
              status={match.status} clock={page.matchDetails?.find(detail => detail.id === match.id)}
              homeGoals={match.scoreOur} awayGoals={match.scoreOpp} time={match.kickoffTimeLabel}
              phase={match.groupLabel ? `Gruppe ${match.groupLabel}` : 'Turnierspiel'}
              logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl}
            />
            <span className="block border-t border-[var(--t-border)] px-4 py-3 text-sm font-bold text-[var(--t-accent)]">
              Spielverlauf aufklappen ⌄
            </span>
          </summary>
          <PublicTournamentMatchView timelineOnly page={page} match={match} view="ticker"
            onView={view => setSearchParams({ spiel: match.id, ansicht: view })} />
        </details>
      ))}
      {!groupedMatches.live.length && !groupedMatches.results.length
        ? <p className={card}>Noch keine Spiele mitgetickert.</p> : null}
    </section>
  ) : null;
  const presentationMode=searchParams.get('modus');
  if(!embedded && page && presentationMode==='print') return <TournamentPresentation page={page} mode="print" error={error}/>;
  if(!embedded && page && presentationMode==='screen') {
    if(screenAccess.canScreen) return <TournamentPresentation page={page} mode="screen" error={error}/>;
    return <main className="mx-auto max-w-xl space-y-4 p-6 pt-[max(2rem,env(safe-area-inset-top))]"><Link to="?">← Turnierseite</Link><h1 className="text-2xl font-bold">Bildschirmmodus</h1><p role="status">{screenAccess.loading?'Berechtigung wird geprüft…':screenAccess.error?'Berechtigung konnte nicht geprüft werden.':'Nur für Vereinsadmins und die eingeteilte Turnierleitung. Bitte mit dem berechtigten Konto anmelden.'}</p><Link to="/login">Zur Anmeldung</Link><button onClick={()=>void refreshScreenAccess()}>Erneut prüfen</button></main>;
  }
  const ContentTag=embedded?'div':'main';
  const accent = normalizeBrandColor(page?.accentColor) ?? '#c82333';
  const pageActions = (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={()=>void onShare()} aria-label="Teilen" title="Teilen" className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 text-sm font-bold"><Share2 size={18} aria-hidden/><span className={isNextProOverview ? "hidden min-[380px]:inline" : undefined}>Teilen</span></button>
      <button type="button" onClick={toggleTheme} aria-label={theme === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten'} title={theme === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text)]">{theme === 'night' ? <Sun size={20} aria-hidden/> : <Moon size={20} aria-hidden/>}</button>
    </div>
  );
  const pageHeader = (
    <header className="flex items-center justify-between gap-2">
        {isNextProOverview && !appReturnTo ? (
          <button type="button" onClick={() => {
            setTab('ours');
            scrollSurface.current?.scrollTo({ top: 0 });
          }} className="inline-flex min-h-11 min-w-0 items-center rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-sm font-bold">
            ↑ Nach oben
          </button>
        ) : (
          <Link to={selectedMatch && !returnsToLive ? location.pathname : returnTo} state={location.state} aria-label={returnsToLive ? 'Zurück zum Livespiel' : 'Zurück zum Turnier'} className="inline-flex min-h-11 min-w-0 items-center rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-sm font-bold">← Zurück<span className="ml-1 hidden min-[380px]:inline">{returnsToLive ? 'zum Livespiel' : 'zum Turnier'}</span></Link>
        )}
        {!isNextProOverview ? pageActions : null}
      </header>
  );
  const presentationTools = page && !embedded ? <>
    <TournamentPresentationTools page={page} canScreen={screenAccess.canScreen} onShare={() => void onShare()} />
    {screenAccess.canManage ? <TournamentScreenManagers eventId={publicId} onChanged={() => void refreshScreenAccess()} /> : null}
  </> : null;

  const tournamentInfo = page ? <details className="mt-2 text-xs text-[var(--t-muted)]"><summary className="cursor-pointer py-1 font-semibold">Turnierinfos & Aktualisierung</summary><p className="mt-2">{[page.teamName,page.seasonLabel].filter(Boolean).join(' · ')}</p><p className="mt-1 flex items-center gap-1"><MapPin size={14}/>{page.venue}</p><p className="mt-1">{page.allMatches.some(m=>m.status==='live')?'Läuft':page.tournamentStatusLabel}{page.syncedAt ? ` · Veranstalterstand ${new Date(page.syncedAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}` : ''}</p></details> : null;

  const openTournamentSection = (section: 'games' | 'ticker') => {
    setTab(section);
    if (section === 'games') setScheduleView('upcoming');
    const target = section === 'ticker' && playerOpen ? tickerSection : tournamentNavigation;
    target.current?.scrollIntoView({ block: 'start' });
  };

  return <div ref={scrollSurface} data-embedded={embedded || undefined} data-theme={theme} className={`${embedded?'tournament-audience-overview w-full min-w-0':'public-tournament-page bg-[var(--t-bg)]'} text-[var(--t-text)]`} style={{
      '--t-accent': embedded ? 'rgb(var(--club-accent-text-rgb))' : theme === 'day' ? mutedAccentOnLight(accent) : accent,
      '--t-on-accent': theme === 'day' ? '#ffffff' : readableTextColor(accent),
      '--t-bg': theme === 'day' ? '#f7f8fa' : '#0b0b0f',
      '--t-surface': theme === 'day' ? '#ffffff' : '#15151b',
      '--t-text': theme === 'day' ? '#13151b' : '#ffffff',
      '--t-muted': theme === 'day' ? '#526071' : '#b5b5bc',
      '--t-border': theme === 'day' ? 'color-mix(in srgb, var(--t-accent) 10%, #e9e7ec)' : 'color-mix(in srgb, var(--t-accent) 27%, #25252d)',
      '--t-fixture': theme === 'day' ? 'linear-gradient(135deg, var(--t-surface), color-mix(in srgb, var(--t-accent) 3%, var(--t-surface)))' : 'linear-gradient(135deg, var(--t-surface), color-mix(in srgb, var(--t-accent) 10%, var(--t-surface)))',
      '--t-player-badge': theme === 'day' ? '#f1f5f9' : 'rgba(0,0,0,.25)',
      '--t-live': theme==='day'?'#15803d':'#6ee7b7',
      '--t-warning': theme === 'day' ? '#854d0e' : '#fcd34d',
      colorScheme: theme === 'day' ? 'light' : 'dark',
    } as React.CSSProperties}>
    {isNextProOverview && showIntro && !location.hash && searchParams.size === 0 ? <NextProIntro ready={!loading} onFinished={finishIntro} /> : null}
    <ContentTag className={embedded?"space-y-4":"mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-4"}>
      {!embedded && !isNextProOverview ? pageHeader : embedded && selectedMatch ? <button type="button" onClick={()=>setSearchParams({})} className="min-h-11 rounded-full border border-[var(--t-border)] px-4 text-sm font-bold">← Zurück zur Turnierübersicht</button> : null}
      {!isNextProOverview && shareHint ? <p role="status" className="text-sm text-[var(--t-muted)]">{shareHint}</p> : null}
      {loading ? <p>Turnier wird geladen…</p> : !page ? <section className={card}><p>{error || 'Turnier nicht verfügbar'}</p><button onClick={()=>void load()} className="mt-3 underline">Erneut laden</button></section> : <>
        {!isNextProOverview ? presentationTools : null}
        {selectedMatch ? <PublicTournamentMatchView page={page} match={selectedMatch} view={matchView} onView={view=>setSearchParams({spiel:selectedMatch.id,ansicht:view})}/> : <>
        {isNextProOverview ? (
          <section aria-labelledby="nextpro-title" className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 id="nextpro-title" className="text-base font-extrabold leading-snug">{page.tournamentName}</h1>
                <p className="text-xs text-[var(--t-muted)]">{page.dateLabel}</p>
              </div>
              {pageActions}
            </div>
            {shareHint ? <p role="status" className="mt-1 text-xs text-[var(--t-muted)]">{shareHint}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold text-[var(--t-accent)]">
              <button type="button" onClick={() => openTournamentSection('games')} className="min-h-11">Spielplan</button>
              <button type="button" onClick={() => openTournamentSection('ticker')} className="min-h-11">Liveticker</button>
              {livestreamUrl ? <button type="button" onClick={() => livestreamSection.current?.scrollIntoView({ block: 'start' })} className="min-h-11">{streamLabel}</button> : null}
            </div>
          </section>
        ) : null}
        {!embedded && !isNextProOverview ? <section className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-3">
          <div className="flex items-center gap-3"><TournamentClubLogo name={page.teamName} logoUrl={page.teamLogoUrl} size="sm"/><div className="min-w-0 flex-1"><h1 className="text-base font-extrabold leading-snug">{page.tournamentName}</h1><p className="mt-1 text-xs text-[var(--t-muted)]">{page.dateLabel} · {page.ageGroupLabel}</p></div></div>
          {tournamentInfo}
        </section> : null}
        {livestreamUrl ? (
          <section id="livestream" ref={livestreamSection} className={`${card} scroll-mt-4 space-y-3`}>
            <h2 className={heading}>{recording ? 'Turnieraufzeichnung' : 'Livestream'}</h2>
            {recordingParts.length ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Teile der Turnieraufzeichnung">
                {recordingParts.map((url, index) => {
                  const label = `Teil ${index + 1} ansehen`;
                  const buttonClass = 'public-tournament-tab inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--t-border)] px-4 text-sm font-bold';
                  return tournamentLivestreamEmbedUrl(url) ? (
                    <button key={url} type="button" className={buttonClass} aria-pressed={selectedVideo === url}
                      onClick={() => setOpenedStream({ publicId, url })}>
                      <Play size={16} aria-hidden /> {label}
                    </button>
                  ) : (
                    <a key={url} className={buttonClass} href={url} target="_blank" rel="noopener noreferrer">
                      {label} ↗
                    </a>
                  );
                })}
              </div>
            ) : null}
            {playerOpen && embedUrl ? (
              <>
                <iframe
                  title={recording ? 'Turnieraufzeichnung' : 'Turnier-Livestream'}
                  src={embedUrl}
                  className="aspect-video w-full rounded-xl bg-black"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={selectedVideo ?? livestreamUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--t-accent)]">
                    Beim Anbieter öffnen ↗
                  </a>
                  <button type="button" onClick={() => setOpenedStream({ publicId, url: null })}
                    className="min-h-11 px-2 text-sm font-bold text-[var(--t-muted)]">
                    Player schließen
                  </button>
                </div>
              </>
            ) : recordingParts.length ? null : canOpenPlayer ? (
              <button type="button" onClick={() => setOpenedStream({ publicId, url: livestreamUrl })}
                className="public-tournament-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-bold">
                <Play size={18} aria-hidden /> {streamLabel}
              </button>
            ) : (
              <a href={livestreamUrl} target="_blank" rel="noopener noreferrer"
                className="public-tournament-cta flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-bold">
                <Play size={18} aria-hidden /> {streamLabel} ↗
              </a>
            )}
          </section>
        ) : null}
        {playerOpen ? ticker : null}
        {error?<p role="status" className="text-[var(--t-warning)]">Aktualisierung nicht möglich – letzter geladener Stand.</p>:null}
        {hasLiveGames ? (
          <section aria-label="Laufende Turnierspiele" className="space-y-3">
            <h2 className={heading}>Gerade live</h2>
            {liveGameCards.map(entry => entry.card)}
          </section>
        ) : null}
        {groupHighlight && currentGroupFixture ? (
          <section aria-label="Spiel unserer Gruppe">
            {embedded && groupHighlight.state === 'next' ? nextMatchHeading : <h2 className={heading}>
              {groupHighlight.state === 'live'
                ? 'Gerade live in unserer Gruppe'
                : groupHighlight.state === 'on_schedule' ? 'Jetzt laut Spielplan' : 'Nächstes Gruppenspiel'}
            </h2>}
            <TournamentFanFixture
              prominent
              kickoffLabel={embedded ? 'Anpfiff' : undefined}
              home={currentGroupFixture.homeTeam}
              away={currentGroupFixture.awayTeam}
              status={groupHighlight.state === 'on_schedule' ? 'scheduled-live' : currentGroupFixture.status}
              homeGoals={currentGroupFixture.liveHomeGoals ?? null}
              awayGoals={currentGroupFixture.liveAwayGoals ?? null}
              time={currentGroupFixture.time}
              phase={`Gruppe ${currentGroupFixture.groupLabel}`}
              logos={page.teamLogos}
              ownName={page.ownParticipantName}
              ownLogo={page.teamLogoUrl}
            />
            {highlightedOwnMatch ? (
              <Link to={`?spiel=${encodeURIComponent(highlightedOwnMatch.id)}`} className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-[var(--t-border)] px-4 text-sm font-bold text-[var(--t-accent)]">
                Zum Spiel →
              </Link>
            ) : null}
          </section>
        ) : null}
        {featuredMatch ? (
          <section aria-label={featuredMatch.status === 'live' ? 'Aktuelles Livespiel' : 'Nächstes eigenes Spiel'}>
            {embedded && featuredMatch.status === 'upcoming' ? nextMatchHeading : null}
            {renderOwnCard(featuredMatch, true)}
          </section>
        ) : null}
        {featuredOwnFixture ? (
          <section aria-label={featuredFixtureIsCurrent ? 'Aktuelles Spiel' : 'Nächstes eigenes Spiel'}>
            {embedded && !featuredFixtureIsCurrent ? nextMatchHeading : null}
            {renderScheduledFixture(featuredOwnFixture, 0)}
          </section>
        ) : null}
        <nav ref={tournamentNavigation} aria-label="Turnierbereiche" className="tournament-filter-track scroll-mt-4 space-y-1 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-1">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4" role="group" aria-label="Spiele und Tabelle">{[['ours','Unsere Spiele'],['games','Alle Spiele'],['ticker','Liveticker'],['tables','Tabellen']].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>{
            setTab(id);
            if (id === 'ticker' && playerOpen) tickerSection.current?.scrollIntoView({ block: 'start' });
          }} className="public-tournament-tab min-h-11 min-w-0 rounded-xl px-2 text-sm font-bold">{label}</button>)}</div>
          <div className="grid grid-cols-3 gap-1 border-t border-[var(--t-border)] pt-1" role="group" aria-label="Finalrunde, Torschützen und Mannschaft">{[['final','Finalrunde'],['scorers','Torschützen'],['roster','Unser Team']].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)} className="public-tournament-tab min-h-11 min-w-0 rounded-xl px-1 text-[13px] font-bold sm:text-sm">{label}</button>)}</div>
        </nav>
        {tab==='ours'? <section className="space-y-4">
          {remainingOwnCards.length ? (
            <div className="space-y-2">
              <h2 className={heading}>{featuredMatch?.status === 'live' || featuredOwnFixture?.status === 'live' ? 'Danach' : 'Weitere Spiele'}</h2>
              {remainingOwnCards.map(entry => entry.card)}
            </div>
          ) : !featuredMatch && !featuredOwnFixture ? (
            <p className={page.allMatches.length || unlinkedOwnFixtures.length ? 'text-sm text-[var(--t-muted)]' : card}>
              {page.allMatches.length || unlinkedOwnFixtures.length ? 'Keine weiteren Spiele geplant.' : 'Unsere Mannschaft ist noch nicht zugeordnet.'}
            </p>
          ) : null}
          {ownResultCards.length ? (
            <div className="space-y-3">
              <h2 className={heading}>Ergebnisse</h2>
              {ownResultCards.map(entry => entry.card)}
            </div>
          ) : null}
          {groupedMatches.canceled.length ? <details><summary className="cursor-pointer py-2 text-sm text-[var(--t-muted)]">Abgesagte Spiele · {groupedMatches.canceled.length}</summary><div className="space-y-2">{groupedMatches.canceled.map(m=>renderOwnCard(m))}</div></details> : null}
        </section> : null}

        {tab==='tables'?<>{finalRanking}{!(page.groupTables?.length)?<p className={card}>Noch keine Gruppentabellen vorhanden.</p>:page.groupTables.map(g=><section className={card} key={g.groupLabel}><h2 className={heading}>Gruppe {g.groupLabel}</h2><table className="w-full table-fixed text-[15px]"><thead className="text-xs text-[var(--t-muted)]"><tr><th className="w-7 py-2 text-left">#</th><th className="text-left">Mannschaft</th><th className="w-8">Sp.</th><th className="w-12">Tore</th><th className="w-9">Pkt.</th></tr></thead><tbody>{g.rows.map(r=><tr key={r.teamName} className="border-t border-[var(--t-border)]"><td className="py-3 font-bold">{r.rank || '–'}</td><td className="py-3 pr-2 font-semibold break-words"><span className="flex items-center gap-2">{<FanTeamLogo name={r.teamName} logos={page.teamLogos} ownName={page.ownParticipantName} ownLogo={page.teamLogoUrl} small/>}{r.teamName}</span></td><td className="text-center tabular-nums">{r.played}</td><td className="text-center tabular-nums">{r.goalsFor}:{r.goalsAgainst}</td><td className="text-center font-extrabold tabular-nums">{r.points}</td></tr>)}</tbody></table></section>)}<p className="text-sm text-[var(--t-muted)]">{page.standingsProvisional ? 'Vorläufig · eigene abgeschlossene Spiele und Veranstalterergebnisse berücksichtigt. Sortierung: Punkte, Tordifferenz, erzielte Tore; die offizielle Platzierung kann bei Gleichstand abweichen.' : 'Veranstaltertabelle'}</p></>:null}
        {tab==='games'||tab==='final'? <section className="space-y-4"><h2 className={heading}>{tab==='final'?'Final- und Platzierungsspiele':'Spielplan & Ergebnisse'}</h2>
          {tab==='games'?<><div className="tournament-filter-track grid grid-cols-2 gap-2 rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-1" role="group" aria-label="Spielplan oder Ergebnisse">{([['upcoming','Spielplan',scheduledUpcoming.length],['results','Ergebnisse',scheduledResults.length]] as const).map(([value,label,count])=><button key={value} type="button" aria-pressed={scheduleView===value} onClick={()=>setScheduleView(value)} className="public-tournament-tab min-h-11 rounded-xl px-2 text-sm font-bold">{label} · {count}</button>)}</div>{scheduleView==='upcoming'?(scheduledUpcoming.length?scheduledUpcoming.map(renderScheduledFixture):<p className={card}>Keine weiteren Spiele geplant.</p>):(scheduledResults.length?scheduledResults.map(renderScheduledFixture):<p className={card}>Noch keine Ergebnisse vorhanden.</p>)}</>:!fixtures.length?<p className={card}>Noch keine Spiele hinterlegt.</p>:<>{scheduledUpcoming.map(renderScheduledFixture)}{scheduledResults.map(renderScheduledFixture)}</>}
          {tab==='final'?finalRanking:null}</section>:null}


        {tab === 'ticker' && !playerOpen ? ticker : null}

        {tab==='scorers'?<section className={card}><h2 className={heading}>Unsere Torschützenliste</h2>{page.scorers?.some(s=>s.example)?<p className="mb-3 text-sm text-[var(--t-warning)]">TEST-Beispieldaten aus unserem Kader – keine bestätigten historischen Torschützen.</p>:null}{scorerTotals.length?<ol className="space-y-3">{scorerTotals.map((s,i)=><li key={s.name}><TournamentFanPlayerCard player={profileFor(s.name)} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl} goals={s.goals} rank={i+1}/></li>)}</ol>:<p>Noch keine Torschützen erfasst.</p>}</section>:null}
        {tab==='roster'?<section className={card}><h2 className={heading}>Unser Team</h2>{page.fanRosterExample?<p className="mb-3 text-sm text-[var(--t-muted)]">TEST-Beispiel mit Bildern und Nummern aus unserem aktuellen Kader.</p>:null}{rosterPlayers.length?<ul className="space-y-3">{rosterPlayers.map(player=><li key={player.name}><TournamentFanPlayerCard player={player} clubName={page.ownParticipantName || page.teamName} clubLogo={page.teamLogoUrl}/></li>)}</ul>:<p>Der Turnierkader ist noch nicht festgelegt.</p>}</section>:null}
        </>}
        {isNextProOverview ? <>{pageHeader}{presentationTools}<section className={card}>{tournamentInfo}</section></> : null}
        {!embedded ? <Link to={returnTo} className="public-tournament-cta block rounded-full px-5 py-3 text-center text-sm font-bold">Zum Turniercenter in der App</Link> : null}
      </>}
    </ContentTag>
  </div>;
}
