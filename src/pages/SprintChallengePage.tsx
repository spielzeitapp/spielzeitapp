import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Timer, ChevronLeft } from 'lucide-react';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useSprintChallenge } from '../hooks/useSprintChallenge';
import { normalizeRole, canManageMatches } from '../lib/roles';
import { bestSprintTime, formatSprintTime, parseSprintSeconds, rankSprintResults, type SprintAttempts } from '../lib/sprintChallenge';
import { dsPageTitleClass, dsPrimaryCtaClass, dsSecondaryCtaClass, dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, PremiumCard } from '../ui';
const INPUT = 'min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white';
const EMPTY: SprintAttempts = [null, null, null];
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function SprintChallengePage() {
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const { activeTeamSeasonId, isHistoryReadOnly, role, loading: seasonLoading } = useActiveTeamSeason();
  const allowed = !seasonLoading && canManageMatches(normalizeRole(role)) && !isHistoryReadOnly;
  const { players, loading: playersLoading } = usePlayers(allowed ? activeTeamSeasonId : null, { mode: 'active' });
  const challenge = useSprintChallenge(activeTeamSeasonId, allowed, eventId);
  const [date, setDate] = useState(today);
  const [playerId, setPlayerId] = useState('');
  const [drafts, setDrafts] = useState(['', '', '']);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const startedAt = useRef<number | null>(null);
  useEffect(() => { setPlayerId(''); setMessage(''); }, [activeTeamSeasonId]);
  useEffect(() => { if (!players.some(player => player.id === playerId)) setPlayerId(players[0]?.id ?? ''); }, [players, playerId]);
  useEffect(() => {
    const values = challenge.results[playerId] ?? EMPTY;
    setDrafts(values.map(value => value == null ? '' : String(value / 1000).replace('.', ',')));
    setElapsed(0); setMessage('');
  }, [playerId, challenge.testId, challenge.results]);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setElapsed(performance.now() - (startedAt.current ?? performance.now())), 30);
    return () => window.clearInterval(interval);
  }, [running]);
  useEffect(() => {
    startedAt.current = null; setRunning(false);
  }, [activeTeamSeasonId, challenge.testId, playerId]);
  const ranking = useMemo(() => rankSprintResults(players.map(player => ({ playerId: player.id, playerName: player.display_name, attempts: challenge.results[player.id] ?? EMPTY }))), [players, challenge.results]);
  const busy = challenge.saving || running;
  const parsed = drafts.map(raw => raw.trim() ? parseSprintSeconds(raw) : null) as SprintAttempts;
  const invalid = drafts.some((raw, index) => raw.trim() !== '' && parsed[index] == null);
  const dirty = drafts.some((raw, index) => (raw.trim() ? parseSprintSeconds(raw) : null) !== (challenge.results[playerId] ?? EMPTY)[index]) || invalid;
  const canLeaveDraft = () => !dirty || window.confirm('Nicht gespeicherte Zeiten verwerfen?');
  useEffect(() => {
    if (!dirty && !running) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, running]);
  const measure = () => {
    setMessage('');
    if (!running) { startedAt.current = performance.now(); setElapsed(0); setRunning(true); }
    else {
      const milliseconds = Math.round(performance.now() - (startedAt.current ?? performance.now()));
      startedAt.current = null; setRunning(false); setElapsed(milliseconds);
      if (milliseconds < 1 || milliseconds > 60000) { setMessage('Bitte eine Zeit zwischen 0 und 60 Sekunden messen.'); return; }
      setDrafts(previous => previous.map((value, index) => index === attemptIndex ? (milliseconds / 1000).toFixed(3).replace('.', ',') : value));
    }
  };
  const save = async () => {
    if (invalid) { setMessage('Bitte gültige Sekunden eingeben, zum Beispiel 3,42.'); return; }
    setMessage('');
    if (await challenge.save(playerId, parsed)) setMessage('Zeiten gespeichert.');
  };
  const startTest = async () => {
    if (!canLeaveDraft()) return;
    setMessage('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setMessage('Bitte ein Testdatum wählen.'); return; }
    await challenge.createTest(date);
  };
  if (!seasonLoading && !allowed) return <Navigate to="/app/team?tab=training" replace />;
  return <PageShell background="default" className="w-full px-3 py-6 pb-36 sm:px-4" contentClassName="mx-auto max-w-3xl space-y-4">
    <Link to={eventId ? '/app/events/' + encodeURIComponent(eventId) : '/app/team?tab=training'} className={dsPanelRowClass() + ' inline-flex items-center gap-2 text-sm text-white/80'}><ChevronLeft className="h-4 w-4" aria-hidden />Zurück zum Training</Link>
    <div className="flex items-center gap-3"><Timer className="sz-club-accent-text h-7 w-7 shrink-0" aria-hidden /><h1 className={dsPageTitleClass()}>Sprint-Challenge</h1></div>
    <p className="text-sm text-white/65">Torlinie → 16er-Linie · 16,5 Meter<br />3 Versuche pro Spieler · die schnellste Zeit zählt.</p>
    {seasonLoading || playersLoading || challenge.loading ? <p className="text-sm text-white/60">Lade Sprint-Tests…</p> : <>
      <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3">
        <h2 className="text-lg font-bold text-white">Test auswählen</h2>
        {challenge.tests.length ? <label className="block text-sm text-white/65">Bisherige Tests<select className={INPUT + ' mt-1'} value={challenge.testId} onChange={event => { if (canLeaveDraft()) challenge.setTestId(event.target.value); }} disabled={busy}>
          <option value="">Test auswählen</option>{challenge.tests.map(test => <option key={test.id} value={test.id}>{test.start_date ? new Date(test.start_date + 'T12:00:00').toLocaleDateString('de-AT') : 'Ohne Datum'} · 16,5 m{test.event_id ? ' · Training' : ''}</option>)}
        </select></label> : <p className="text-sm text-white/55">Noch kein Sprint-Test. Lege den ersten Test an.</p>}
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm text-white/65">Testdatum<input className={INPUT + ' mt-1'} type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></label>
          <button type="button" className={dsSecondaryCtaClass() + ' min-h-11'} onClick={() => void startTest()} disabled={busy || !date}>Neuer Test</button>
        </div>
        <p className="text-xs text-white/45">{eventId ? 'Neue Tests werden diesem Training zugeordnet. ' : ''}Bisherige Tests bleiben gespeichert.</p>
      </PremiumCard>
      {challenge.testId && players.length > 0 ? <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3">
        <h2 className="text-lg font-bold text-white">Zeiten erfassen</h2>
        <label className="block text-sm text-white/65">Spieler<select className={INPUT + ' mt-1'} value={playerId} onChange={event => { if (canLeaveDraft()) setPlayerId(event.target.value); }} disabled={busy}>{players.map(player => <option key={player.id} value={player.id}>{player.display_name}</option>)}</select></label>
        <div className="grid grid-cols-3 gap-2">{drafts.map((value, index) => <label key={index} className="min-w-0 text-xs text-white/65">Versuch {index + 1} · s<input aria-label={'Versuch ' + (index + 1) + ' in Sekunden'} className={INPUT + ' mt-1 tabular-nums'} type="text" inputMode="decimal" placeholder="3,42" value={value} disabled={busy} onChange={event => setDrafts(previous => previous.map((raw, i) => i === index ? event.target.value : raw))} /></label>)}</div>
        <p className="text-sm font-bold text-white">Bestzeit: {formatSprintTime(bestSprintTime(parsed))}</p>
        {invalid ? <p className="text-sm text-amber-200" role="alert">Zeiten müssen größer als 0 und höchstens 60 Sekunden sein, mit maximal drei Nachkommastellen.</p> : null}
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <label className="block text-xs text-white/55">Versuch messen<select className={INPUT + ' mt-1'} value={attemptIndex} onChange={event => setAttemptIndex(Number(event.target.value))} disabled={busy}>{[0,1,2].map(index => <option key={index} value={index}>Versuch {index + 1}</option>)}</select></label>
          <p className="my-3 text-center text-4xl font-bold tabular-nums text-white" aria-live={running ? 'off' : 'polite'}>{(elapsed / 1000).toFixed(2).replace('.', ',')} <span className="text-lg text-white/50">s</span></p>
          <button type="button" className={dsPrimaryCtaClass() + ' min-h-11 w-full touch-manipulation'} disabled={challenge.saving} onClick={measure}>{running ? 'Stopp' : 'Start'}</button>
          <p className="mt-2 text-xs text-white/45">Nach Stopp wird die Zeit eingetragen. Anschließend speichern.</p>
        </div>
        <button type="button" className={dsPrimaryCtaClass() + ' min-h-11 w-full'} disabled={busy || invalid} onClick={() => void save()}>{challenge.saving ? 'Speichern…' : 'Zeiten speichern'}</button>
      </PremiumCard> : challenge.testId ? <p className="text-sm text-white/55">Keine aktiven Spieler im Kader.</p> : null}
      {challenge.testId ? <PremiumCard variant="subtle" showAmbientGlow={false}>
        <h2 className="text-lg font-bold text-white">Rangliste · Bestzeit</h2>
        <p className="mt-1 text-xs text-white/50">Die kleinste Zeit gewinnt. Unvollständige Tests sind mit der Anzahl der Versuche markiert.</p>
        {ranking.length ? <ol className="mt-3 space-y-2">{ranking.map(row => <li key={row.playerId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <span className="min-w-0 text-sm font-semibold text-white"><span className="mr-2 text-white/50">{row.rank}.</span>{row.playerName}<span className="ml-2 text-xs text-white/45">{row.attempts.filter(value => value != null).length}/3</span></span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-white">{formatSprintTime(row.best)}</span>
        </li>)}</ol> : <p className="mt-3 text-sm text-white/55">Noch keine Zeiten gespeichert.</p>}
      </PremiumCard> : null}
    </>}
    {challenge.error ? <p className="text-sm text-amber-200" role="alert">{challenge.error}</p> : null}
    {message ? <p className="text-sm text-white/80" role="status">{message}</p> : null}
    <p className="text-xs leading-relaxed text-white/45">Immer dieselbe Strecke und Startregel verwenden. Manuelles Stoppen ist eine Handmessung.</p>
  </PageShell>;
}
