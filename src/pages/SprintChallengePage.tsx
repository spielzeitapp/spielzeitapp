import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Timer, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useSprintChallenge, type SprintMeasurementMethod } from '../hooks/useSprintChallenge';
import { normalizeRole, canManageMatches } from '../lib/roles';
import { bestSprintTime, formatSprintTime, parseSprintSeconds, rankSprintResults, sprintProgress, sprintDevelopmentRanking, type SprintAttempts, type SprintHistoryEntry } from '../lib/sprintChallenge';
import { dsPageTitleClass, dsPrimaryCtaClass, dsSecondaryCtaClass, dsPanelRowClass } from '../lib/premiumDesignSystem';
import { useInternalBasePath } from '../demo/demoPaths';
import { PageShell, PremiumCard } from '../ui';
import { SprintChoice } from '../components/team/SprintChoice';
const INPUT = 'min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white';
const EMPTY: SprintAttempts = [null, null, null];
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function SprintChallengePage() {
  const basePath = useInternalBasePath();
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const { activeTeamSeasonId, isHistoryReadOnly, role, loading: seasonLoading } = useActiveTeamSeason();
  const allowed = !seasonLoading && canManageMatches(normalizeRole(role)) && !isHistoryReadOnly;
  const { players, loading: playersLoading } = usePlayers(allowed ? activeTeamSeasonId : null, { mode: 'active' });
  const challenge = useSprintChallenge(activeTeamSeasonId, allowed, eventId);
  const [date, setDate] = useState(today);
  const [newMethod, setNewMethod] = useState<SprintMeasurementMethod>('hand');
  const [showNewTest, setShowNewTest] = useState(false);
  const [showStopwatch, setShowStopwatch] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [attendance, setAttendance] = useState<'open'|'participated'|'absent'>('open');
  const [rankingTab, setRankingTab] = useState<'time'|'seconds'|'percent'>('time');
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
    setAttendance(challenge.participation?.[playerId] ?? (bestSprintTime(values) != null ? 'participated' : 'open'));
    setElapsed(0);
  }, [playerId, challenge.testId, challenge.results, challenge.participation]);
  useEffect(() => { setMessage(''); }, [playerId, challenge.testId]);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setElapsed(performance.now() - (startedAt.current ?? performance.now())), 30);
    return () => window.clearInterval(interval);
  }, [running]);
  useEffect(() => {
    startedAt.current = null; setRunning(false); setShowStopwatch(false);
  }, [activeTeamSeasonId, challenge.testId, playerId]);
  const ranking = useMemo(() => rankSprintResults(players.map(player => ({ playerId: player.id, playerName: player.display_name, attempts: challenge.results[player.id] ?? EMPTY }))), [players, challenge.results]);
  const busy = challenge.saving || running;
  const currentTest = challenge.tests.find(test => test.id === challenge.testId);
  const method = currentTest?.measurement_method ?? null;
  const methodLabel = (value: SprintMeasurementMethod | null) => value === 'light_gate' ? 'Lichtschranke' : value === 'hand' ? 'Handmessung' : 'Messart offen';
  const parsed = drafts.map(raw => raw.trim() ? parseSprintSeconds(raw) : null) as SprintAttempts;
  const invalid = drafts.some((raw, index) => raw.trim() !== '' && parsed[index] == null);
  const savedAttendance = challenge.participation?.[playerId] ?? (bestSprintTime(challenge.results[playerId] ?? EMPTY) != null ? 'participated' : 'open');
  const dirty = attendance !== savedAttendance || drafts.some((raw, index) => (raw.trim() ? parseSprintSeconds(raw) : null) !== (challenge.results[playerId] ?? EMPTY)[index]) || invalid;
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
  const save = async (next = false) => {
    if (!method) { setMessage('Bitte zuerst die Messart für diesen Test festlegen.'); return; }
    if (attendance !== 'absent' && bestSprintTime(parsed) == null) { setMessage('Noch keine Messwerte. Spieler ohne Zeiten bitte überspringen oder als „Nicht dabei“ markieren.'); return; }
    if (invalid) { setMessage('Bitte gültige Sekunden eingeben, zum Beispiel 3,42.'); return; }
    setMessage('');
    if (await challenge.save(playerId, attendance === 'absent' ? EMPTY : parsed, attendance === 'absent' ? 'absent' : 'participated')) {
      const index = players.findIndex(player => player.id === playerId);
      if (next && index >= 0 && index < players.length - 1) {
        setPlayerId(players[index + 1].id);
        setAttemptIndex(0); setShowStopwatch(false);
        document.querySelector('input[aria-label="Versuch 1 in Sekunden"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else setMessage(next ? 'Letzter Spieler gespeichert.' : 'Zeiten gespeichert.');
    }
  };
  const startTest = async () => {
    if (!canLeaveDraft()) return;
    setMessage('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setMessage('Bitte ein Testdatum wählen.'); return; }
    if (await challenge.createTest(date, newMethod)) setShowNewTest(false);
  };
  const currentEntry = (id: string, attempts: SprintAttempts, participation: 'absent'|'participated'|null): SprintHistoryEntry => ({
    testId: challenge.testId,playerId:id,date:currentTest?.start_date ?? null,createdAt:currentTest?.created_at ?? '',
    method,attempts,participation
  });
  const selectedProgress = sprintProgress(challenge.history ?? [], currentEntry(playerId,parsed,attendance === 'absent' ? 'absent' : null));
  const progressRows = players.map(player => ({ playerId:player.id,playerName:player.display_name,
    ...sprintProgress(challenge.history ?? [],currentEntry(player.id,challenge.results[player.id] ?? EMPTY,challenge.participation?.[player.id] ?? null))
  }));
  const absoluteRanking = sprintDevelopmentRanking(progressRows,'seconds');
  const percentRanking = sprintDevelopmentRanking(progressRows,'percent');
  const noValues = players.filter(player => bestSprintTime(challenge.results[player.id] ?? EMPTY) == null);
  const skipPlayer = () => {
    if (!canLeaveDraft()) return;
    const index = players.findIndex(player => player.id === playerId);
    if (index >= 0 && index < players.length - 1) setPlayerId(players[index + 1].id);
    else setMessage('Letzter Spieler. Ohne Messwerte gibt es keine Zeitwertung.');
  };
  if (!seasonLoading && !allowed) return <Navigate to={`${basePath}/team?tab=training`} replace />;
  return <PageShell background="default" className="w-full px-3 py-6 pb-36 sm:px-4" contentClassName="mx-auto max-w-3xl space-y-4">
    <Link to={eventId ? basePath + '/events/' + encodeURIComponent(eventId) : basePath + '/team?tab=training'} className={dsPanelRowClass() + ' inline-flex items-center gap-2 text-sm text-white/80'}><ChevronLeft className="h-4 w-4" aria-hidden />Zurück zum Training</Link>
    <div className="flex items-center gap-3"><Timer className="sz-club-accent-text h-7 w-7 shrink-0" aria-hidden /><h1 className={dsPageTitleClass()}>Sprint-Challenge</h1></div>
    <p className="text-sm text-white/65">Torlinie → 16er-Linie · 16,5 Meter<br />3 Versuche pro Spieler · die schnellste Zeit zählt.</p>
    {seasonLoading || playersLoading || challenge.loading ? <p className="text-sm text-white/60">Lade Sprint-Tests…</p> : <>
      <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3">
        {challenge.tests.length ? <SprintChoice label="Sprint-Test" value={challenge.testId} disabled={busy}
          options={challenge.tests.map(test => ({ value: test.id, label: test.start_date ? new Date(test.start_date + 'T12:00:00').toLocaleDateString('de-AT') : 'Ohne Datum', detail: '16,5 m · ' + methodLabel(test.measurement_method) + (test.event_id ? ' · Training' : '') }))}
          onChange={value => { if (canLeaveDraft()) challenge.setTestId(value); }} /> : <p className="text-sm text-white/55">Noch kein Sprint-Test. Lege den ersten Test an.</p>}
        {currentTest && !method ? <div className="space-y-2">
          <p className="text-xs text-white/60">Messart für diesen Test festlegen. Vorhandene Zeiten bleiben erhalten.</p>
          <div className="grid grid-cols-2 gap-2">{(['hand','light_gate'] as SprintMeasurementMethod[]).map(value => <button key={value} type="button" className={dsSecondaryCtaClass() + ' min-h-11 !px-2 text-sm'} disabled={busy} onClick={() => void challenge.setMeasurementMethod(value)}>{methodLabel(value)}</button>)}</div>
        </div> : null}
        {challenge.tests.length ? <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-sm font-semibold text-white/75" onClick={() => setShowNewTest(value => !value)} disabled={busy} aria-expanded={showNewTest}>
          Neuer Test {showNewTest ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </button> : null}
        {!challenge.tests.length || showNewTest ? <div className="space-y-3 border-t border-white/10 pt-3">
          <label className="block text-xs text-white/55">Testdatum<input className={INPUT + ' mt-1'} type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></label>
          <div><p className="mb-1 text-xs text-white/55">Messart</p><div className="grid grid-cols-2 gap-2">{(['hand','light_gate'] as SprintMeasurementMethod[]).map(value => <button key={value} type="button" aria-pressed={newMethod === value} disabled={busy} onClick={() => setNewMethod(value)}
            className={'min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold ' + (newMethod === value ? 'border-[rgb(var(--club-border-rgb)/0.5)] bg-[rgb(var(--club-primary-rgb)/0.2)] text-white' : 'border-white/10 text-white/55')}>{methodLabel(value)}</button>)}</div></div>
          <button type="button" className={dsSecondaryCtaClass() + ' min-h-11 w-full'} onClick={() => void startTest()} disabled={busy || !date}>Test anlegen</button>
          <p className="text-xs text-white/45">{eventId ? 'Diesem Training zugeordnet. ' : ''}Bisherige Tests bleiben gespeichert.</p>
        </div> : null}
      </PremiumCard>
      {challenge.testId && players.length > 0 ? <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3">
        <h2 className="text-lg font-bold text-white">Zeiten erfassen</h2>
        <SprintChoice label="Spieler" value={playerId} disabled={busy}
          options={players.map(player => ({ value: player.id, label: player.display_name, detail: challenge.participation?.[player.id] === 'absent' ? 'Nicht dabei · ohne Wertung' : bestSprintTime(challenge.results[player.id] ?? EMPTY) == null ? 'Noch keine Messwerte' : (challenge.results[player.id] ?? EMPTY).filter(value => value != null).length + '/3 erfasst' }))}
          onChange={value => { if (canLeaveDraft()) setPlayerId(value); }} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={attendance !== 'absent'} disabled={busy} className={dsSecondaryCtaClass() + ' min-h-11 !px-2'} onClick={() => setAttendance('participated')}>Teilnehmen</button>
          <button type="button" aria-pressed={attendance === 'absent'} disabled={busy} className={dsSecondaryCtaClass() + ' min-h-11 !px-2'} onClick={() => {
            if (bestSprintTime(parsed) != null && !window.confirm('Zeiten dieses Tests entfernen und „Nicht dabei“ markieren? Frühere Tests bleiben erhalten.')) return;
            setDrafts(['','','']); setAttendance('absent'); setShowStopwatch(false);
          }}>Nicht dabei</button>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-xs text-white/50">Bisherige persönliche Bestzeit · {methodLabel(method)}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">{formatSprintTime(selectedProgress.previousBest)}</p>
          <p className="mt-1 text-xs text-white/45">{selectedProgress.previousTime == null ? 'Noch keine vergleichbare Messung.' : 'Letzte Messung: ' + formatSprintTime(selectedProgress.previousTime)}</p>
        </div>
        {attendance === 'absent' ? <p className="text-sm text-white/65">Nicht dabei — keine Zeit und keine Wertung für diesen Test.</p> : null}
        <div className="grid grid-cols-3 gap-2">{drafts.map((value, index) => <label key={index} className="min-w-0 text-xs text-white/65">Versuch {index + 1} · s<input aria-label={'Versuch ' + (index + 1) + ' in Sekunden'} className={INPUT + ' mt-1 tabular-nums'} type="text" inputMode="decimal" placeholder="3,42" value={value} disabled={busy || attendance === 'absent'} onChange={event => setDrafts(previous => previous.map((raw, i) => i === index ? event.target.value : raw))} /></label>)}</div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--club-border-rgb)/0.25)] bg-[rgb(var(--club-primary-rgb)/0.1)] px-3 py-3">
          <div><p className="text-xs text-white/55">Bestzeit dieses Tests</p><p className="sz-club-accent-text mt-0.5 text-2xl font-bold tabular-nums">{formatSprintTime(bestSprintTime(parsed))}</p></div>
          <div className="text-right"><p className="text-xs text-white/65">{parsed.filter(value => value != null).length} von 3 Versuchen erfasst</p><p className="mt-1 text-xs text-white/40">{methodLabel(method)}{dirty ? ' · Noch nicht gespeichert' : ''}</p></div>
        </div>
        {selectedProgress.newPersonalBest ? <p className="text-sm font-bold text-emerald-300">🏆 Neue persönliche Bestzeit!{dirty ? ' · Noch speichern' : ''}</p> : null}
        {selectedProgress.improvementMs != null && attendance !== 'absent' ? <p className="text-sm text-white/70">{selectedProgress.improvementMs > 0 ? 'Verbessert um ' : selectedProgress.improvementMs < 0 ? 'Langsamer um ' : 'Gleich wie zuletzt: '}{formatSprintTime(Math.abs(selectedProgress.improvementMs))} · {Math.abs(selectedProgress.improvementPercent ?? 0).toFixed(2).replace('.',',')} %</p> : null}
        {invalid ? <p className="text-sm text-amber-200" role="alert">Zeiten müssen größer als 0 und höchstens 60 Sekunden sein, mit maximal drei Nachkommastellen.</p> : null}
        <button type="button" className={dsPrimaryCtaClass() + ' min-h-11 w-full'} disabled={busy || invalid || !method} onClick={() => void save(true)}>{challenge.saving ? 'Speichern…' : 'Speichern & nächster Spieler'}</button>
        <button type="button" className="min-h-11 w-full text-sm font-semibold text-white/65" disabled={busy || invalid || !method} onClick={() => void save()}>Nur speichern</button>
        <button type="button" className="min-h-11 w-full text-sm text-white/55" disabled={busy} onClick={skipPlayer}>Überspringen · ohne Wertung</button>
        {attendance === 'absent' ? null : method === 'light_gate' ? <p className="text-xs text-white/45">Lichtschranken-Zeiten direkt eintragen, zum Beispiel 3,427 s.</p> : method === 'hand' ? <>
          <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm font-semibold text-white/65" disabled={busy} onClick={() => setShowStopwatch(value => !value)} aria-expanded={showStopwatch}>
            <span className="flex items-center gap-2"><Timer className="h-4 w-4" aria-hidden />{showStopwatch ? 'Stoppuhr schließen' : 'Stoppuhr öffnen (optional)'}</span>{showStopwatch ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
          {showStopwatch ? <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="mb-2 text-xs text-white/55">Versuch messen</p>
            <div className="grid grid-cols-3 gap-2">{[0,1,2].map(index => <button key={index} type="button" aria-pressed={attemptIndex === index} disabled={busy} onClick={() => setAttemptIndex(index)}
              className={'min-h-11 rounded-xl border py-2 text-xs font-semibold ' + (attemptIndex === index ? 'border-[rgb(var(--club-border-rgb)/0.5)] bg-[rgb(var(--club-primary-rgb)/0.2)] text-white' : 'border-white/10 text-white/55')}>Versuch {index + 1}</button>)}</div>
            <p className="my-3 text-center text-4xl font-bold tabular-nums text-white" aria-live={running ? 'off' : 'polite'}>{(elapsed / 1000).toFixed(2).replace('.', ',')} <span className="text-lg text-white/50">s</span></p>
            <button type="button" className={dsPrimaryCtaClass() + ' min-h-11 w-full touch-manipulation'} disabled={challenge.saving} onClick={measure}>{running ? 'Stopp' : 'Start'}</button>
            <p className="mt-2 text-xs text-white/45">Nach Stopp wird die Zeit eingetragen. Anschließend speichern.</p>
          </div> : null}
        </> : null}
      </PremiumCard> : challenge.testId ? <p className="text-sm text-white/55">Keine aktiven Spieler im Kader.</p> : null}
      {challenge.testId ? <PremiumCard variant="subtle" showAmbientGlow={false}>
        <h2 className="text-lg font-bold text-white">Sprint-Wertungen</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[{title:'🏆 Schnellste Zeit',row:ranking[0],value:ranking[0] ? formatSprintTime(ranking[0].best) : null},
            {title:'🚀 Größte Verbesserung',row:absoluteRanking[0],value:absoluteRanking[0] ? formatSprintTime(absoluteRanking[0].improvementMs) : null},
            {title:'⭐ Beste Entwicklung',row:percentRanking[0],value:percentRanking[0] ? (percentRanking[0].improvementPercent ?? 0).toFixed(2).replace('.',',') + ' %' : null}
          ].map(award => <div key={award.title} className="rounded-xl border border-white/10 bg-black/25 p-3"><p className="text-xs text-white/55">{award.title}</p><p className="mt-1 text-sm font-bold text-white">{award.row?.playerName ?? 'Noch keine Wertung'}</p>{award.value ? <p className="sz-club-accent-text mt-1 text-sm font-semibold">{award.value}</p> : null}</div>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1">{([{id:'time',label:'Bestzeit'},{id:'seconds',label:'Verbesserung'},{id:'percent',label:'Entwicklung'}] as const).map(tab => <button type="button" key={tab.id} aria-pressed={rankingTab===tab.id} onClick={() => setRankingTab(tab.id)} className={'min-h-11 rounded-xl border px-1 text-xs font-semibold ' + (rankingTab===tab.id ? 'border-[rgb(var(--club-border-rgb)/0.5)] bg-[rgb(var(--club-primary-rgb)/0.2)] text-white' : 'border-white/10 text-white/55')}>{tab.label}</button>)}</div>
        <p className="mt-2 text-xs text-white/45">{rankingTab === 'time' ? 'Kleinste Zeit gewinnt. Anzahl der Versuche steht bei jedem Spieler.' : 'Vergleich mit der letzten Messung derselben Messart. Wertung erst ab zwei Messungen; nur positive Verbesserungen.'}</p>
        {rankingTab === 'time' ? <>
        {ranking.length ? <ol className="mt-3 space-y-2">{ranking.map(row => <li key={row.playerId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <span className="min-w-0 text-sm font-semibold text-white"><span className="mr-2 text-white/50">{row.rank}.</span>{row.playerName}<span className="ml-2 text-xs text-white/45">{row.attempts.filter(value => value != null).length}/3</span></span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-white">{formatSprintTime(row.best)}</span>
        </li>)}</ol> : <p className="mt-3 text-sm text-white/55">Noch keine Zeiten gespeichert.</p>}

        </> : <ol className="mt-3 space-y-2">{(rankingTab === 'seconds' ? absoluteRanking : percentRanking).map(row => <li key={row.playerId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3"><span className="min-w-0 text-sm font-semibold text-white">{row.rank}. {row.playerName}</span><span className="shrink-0 text-sm font-bold text-emerald-300">{rankingTab === 'seconds' ? formatSprintTime(row.improvementMs) : (row.improvementPercent ?? 0).toFixed(2).replace('.',',') + ' %'}</span></li>)}
          {!(rankingTab === 'seconds' ? absoluteRanking : percentRanking).length ? <li className="py-3 text-sm text-white/50">Noch keine vergleichbare Verbesserung.</li> : null}
        </ol>}
        {noValues.length ? <details className="mt-4 border-t border-white/10 pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-white/65">Ohne Messwerte · {noValues.length}</summary><ul className="space-y-2 text-sm text-white/55">{noValues.map(player => <li key={player.id}>{player.display_name} · {challenge.participation?.[player.id] === 'absent' ? 'Nicht dabei' : 'Noch keine Messwerte'}</li>)}</ul><p className="mt-2 text-xs text-white/40">Keine Zeit und keine Wertung. Frühere Bestzeiten bleiben erhalten.</p></details> : null}
      </PremiumCard> : null}
    </>}
    {challenge.error ? <p className="text-sm text-amber-200" role="alert">{challenge.error}</p> : null}
    {message ? <p className="text-sm text-white/80" role="status">{message}</p> : null}
    <p className="text-xs leading-relaxed text-white/45">Immer dieselbe Strecke und Startregel verwenden. Manuelles Stoppen ist eine Handmessung.</p>
  </PageShell>;
}
