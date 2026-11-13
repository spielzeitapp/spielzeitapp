import React, { useEffect, useRef, useState } from 'react';
import { Lock, Play, Pause, Shirt, Undo2, Volume2, VolumeX, Goal, Trophy, Crown, Clock3, Trash2 } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { useDemoMode } from '../../demo/DemoContext';
import { creditHallFullDuration, hallPlayerTimes, prepareHallPlayers, changeHallPlayers, withHallFirstPairing, hallGameSeconds, hallPlanSeconds, withHallGameDuration, hallScorers, calculateHallSchedule, createHallDay, hallClock, hallElapsed, hallReady, hallScore, hallStandings, HALL_COLORS, HALL_NAMES, type HallDay } from '../../lib/hallTraining';
import { loadHallDay, saveHallDay } from '../../lib/hallTrainingStore';
import { TC_CARD } from '../tournament/tournamentCenterStyles';
import './hallMatchScreen.css';

type Player = { id: string; display_name?: string | null; name?: string | null; first_name?: string | null; last_name?: string | null };
const input = 'min-h-11 w-full rounded-xl border border-white/15 bg-[#101014] px-3 text-[16px] text-white';
const button = 'sz-club-event-action min-h-12 rounded-full border px-4 py-2 text-[16px] font-bold text-white disabled:opacity-40 touch-manipulation';
function playerName(p: Player) { return p.display_name || p.name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Spieler'; }

export function HallTrainingPlanner({ eventId, startsAt, players, availableIds, open, onClose, onReadyChange, readOnly = false, defaultMinutes = 60, indoor = true }: {
  eventId: string; startsAt: string; players: Player[]; availableIds: string[]; open: boolean; onClose: () => void; onReadyChange: (ready: boolean) => void; readOnly?: boolean; defaultMinutes?: number; indoor?: boolean;
}) {
  const demo = useDemoMode();
  const [day, setDay] = useState<HallDay>(() => createHallDay(indoor ? 3 : 2, 3, Math.max(15, Math.min(180, defaultMinutes)) * 60));
  const [saved, setSaved] = useState<HallDay | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'teams' | 'games' | 'table' | 'times'>('teams');
  const [now, setNow] = useState(Date.now());
  const [count, setCount] = useState(indoor ? 3 : 2), [format, setFormat] = useState<HallDay['format']>(3), [minutes, setMinutes] = useState(defaultMinutes), [pause, setPause] = useState(2), [target, setTarget] = useState(8), [cycles, setCycles] = useState(0);
  const saving = useRef(false);
  const scorerPanel = useRef<HTMLElement | null>(null);
  const [goalPicker, setGoalPicker] = useState<{ game: number; team: number; second: number; timeUnknown?: boolean; ownGoal?: boolean; goal?: number } | null>(null);
  const [correctingGame, setCorrectingGame] = useState<number | null>(null);
  useEffect(() => { setGoalPicker(null); setCorrectingGame(null); }, [eventId, open]);
  useEffect(() => {
    if (goalPicker) { scorerPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); scorerPanel.current?.focus({ preventScroll: true }); }
  }, [goalPicker]);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [durationSeconds, setDurationSeconds] = useState(20);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundError, setSoundError] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const armedGame = useRef<string | null>(null);
  const soundedGame = useRef<string | null>(null);
  const prepareSound = async () => {
    try {
      const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('Audio unavailable');
      if (!audio.current || audio.current.state === 'closed') audio.current = new Ctor();
      if (audio.current.state !== 'running') await audio.current.resume();
      if (audio.current.state !== 'running') throw new Error('Audio suspended');
      setSoundError(null);
      return audio.current;
    } catch {
      setSoundError('Ton konnte nicht aktiviert werden. Bitte „Ton testen“ antippen und Lautstärke prüfen.');
      return null;
    }
  };
  const playSiren = (context: AudioContext) => {
    const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime;
    oscillator.type = 'sine';
    for (let i = 0; i < 6; i++) oscillator.frequency.linearRampToValueAtTime(i % 2 ? 620 : 920, start + i * 0.3);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
    gain.gain.setValueAtTime(0.22, start + 1.7);
    gain.gain.linearRampToValueAtTime(0, start + 1.8);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + 1.8);
  };
  useEffect(() => {
    armedGame.current = null; soundedGame.current = null;
    return () => { const context = audio.current; audio.current = null; if (context) void context.close().catch(() => {}); };
  }, [eventId, open]);
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(day) : day.teams.some((t, i) => t.playerIds.length > 0 || t.name !== ['Rot', 'Blau', 'Gelb', 'Grün'][i]);
  const configDirty = day.games.length !== count * (count - 1) / 2 * day.cycles || count !== day.teams.length || format !== day.format || minutes * 60 !== day.total || pause * 60 !== day.pause || target * 60 !== day.target || (cycles !== 0 && cycles !== day.cycles);
  const started = day.games.some(g => g.status !== 'pending');
  const availableKey = availableIds.join(',');
  const ready = hallReady(day, availableIds);
  const names = new Map(players.map(p => [p.id, playerName(p)]));
  const unavailable = day.teams.flatMap(t => t.playerIds).filter(id => !availableIds.includes(id));
  const init = (loaded: HallDay) => { setDay(loaded); setSaved(structuredClone(loaded)); setCount(loaded.teams.length); setFormat(loaded.format); setMinutes(loaded.total / 60); setPause(loaded.pause / 60); setTarget(loaded.target / 60); setCycles(0); };
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setSaved(null); setRevision(0);
    const empty = createHallDay(indoor ? 3 : 2, 3, Math.max(15, Math.min(180, defaultMinutes)) * 60);
    setDay(empty); setCount(indoor ? 3 : 2); setFormat(3); setMinutes(empty.total / 60); setPause(2); setTarget(8); setCycles(0);
    if (demo) {
      try { const raw = sessionStorage.getItem(`hall-training-demo:${eventId}`); if (raw) init(JSON.parse(raw)); } catch { /* An unavailable demo store does not write to the backend. */ }
      setLoading(false); return;
    }
    loadHallDay(eventId).then(row => { if (!active) return; if (row) { init(row.day); setRevision(row.revision); } setLoading(false); }).catch(e => { if (active) { setError(String(e.message)); setLoading(false); } });
    return () => { active = false; };
  }, [eventId, demo]);
  useEffect(() => { onReadyChange(Boolean(saved) && !loading && !error && !dirty && !configDirty && hallReady(day, availableIds)); }, [day, saved, loading, error, dirty, configDirty, availableKey, onReadyChange]);
  useEffect(() => { if (!open) return; const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, [open]);
  const persist = async (next: HallDay) => {
    if (readOnly || loading || saving.current) return false;
    saving.current = true; setBusy(true); setError(null);
    try {
      const stamp = demo ? revision + 1 : await saveHallDay(eventId, next, revision);
      if (demo) sessionStorage.setItem(`hall-training-demo:${eventId}`, JSON.stringify(next));
      setRevision(stamp); setSaved(structuredClone(next)); setDay(next); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); return false; }
    finally { saving.current = false; setBusy(false); }
  };
  const close = () => { if (busy) return; if ((dirty || configDirty || goalPicker || (activeIndex < 0 && durationDirty)) && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return; if (saved) init(structuredClone(saved)); setGoalPicker(null); onClose(); };
  let preview: ReturnType<typeof calculateHallSchedule> | null = null;
  let calculationError = '';
  try { preview = calculateHallSchedule(count, minutes * 60, pause * 60, target * 60, cycles || undefined); } catch (e) { calculationError = e instanceof Error ? e.message : 'Zeitplanung prüfen'; }
  const generate = async () => {
    if (started || !preview) return;
    const next = createHallDay(count, format, minutes * 60, pause * 60, target * 60, cycles || undefined);
    if (count === day.teams.length) next.teams = structuredClone(day.teams);
    else availableIds.forEach((id, i) => next.teams[i % count].playerIds.push(id));
    if (await persist(next)) setTab('teams');
  };
  const changeTeamCount = (nextCount: number) => {
    if (started || readOnly || busy || ![2, 3, 4].includes(nextCount)) return;
    if (nextCount < day.teams.length && day.teams.slice(nextCount).some(team => team.playerIds.length) && !window.confirm('Die Spieler der entfernten Mannschaft werden wieder nicht zugeteilt. Fortfahren?')) return;
    setCount(nextCount);
    setDay(previous => ({ ...previous, teams: Array.from({ length: nextCount }, (_, i) => previous.teams[i] ?? { name: HALL_NAMES[i], playerIds: [] }) }));
  };
  const firstPairingControl = !started && !readOnly ? <div className="space-y-2 rounded-xl border border-white/10 p-3">
    <label className="block text-[15px] font-semibold text-white/80">Erste Begegnung wählen
      <select aria-label="Erste Begegnung wählen" className={`${input} mt-2`} value={`${day.games[0]?.home}-${day.games[0]?.away}`} disabled={busy || loading || dirty || configDirty || !saved} onChange={e => {
        const [home, away] = e.target.value.split('-').map(Number);
        if (busy || loading || dirty || configDirty || !saved || started) return;
        void persist(withHallFirstPairing(day, home, away));
      }}>{day.teams.flatMap((team, home) => day.teams.filter((_, away) => away !== home).map(other => {
        const away = day.teams.indexOf(other);
        return <option key={`${home}-${away}`} value={`${home}-${away}`}>{team.name} – {other.name}</option>;
      }))}</select>
    </label>
    <p className="text-[13px] leading-relaxed text-white/55">Alle weiteren Paarungen werden automatisch angepasst. Teams und Spielzeiten bleiben erhalten.{!saved || dirty || configDirty ? ' Bitte zuerst Planung und Mannschaften speichern.' : ''}</p>
  </div> : null;
  const assign = (id: string, team: number) => setDay(prev => ({ ...prev, teams: prev.teams.map((t, i) => ({ ...t, playerIds: [...t.playerIds.filter(x => x !== id), ...(i === team ? [id] : [])] })) }));
  const activeIndex = day.games.findIndex(g => g.status === 'running' || g.status === 'paused');
  const nextIndex = day.games.findIndex(g => g.status === 'pending');
  const current = activeIndex >= 0 ? day.games[activeIndex] : null;
  const matchSeconds = current ? hallGameSeconds(day, current) : day.seconds;
  const elapsed = current ? hallElapsed(current, matchSeconds, now) : 0;
  const nextSeconds = nextIndex >= 0 ? hallGameSeconds(day, day.games[nextIndex]) : day.seconds;
  useEffect(() => { setDurationMinutes(Math.floor(nextSeconds / 60)); setDurationSeconds(nextSeconds % 60); }, [eventId, open, nextIndex, nextSeconds]);
  const draftSeconds = durationMinutes * 60 + durationSeconds;
  const durationDirty = nextIndex >= 0 && draftSeconds !== nextSeconds;
  const durationValid = Number.isInteger(durationMinutes) && Number.isInteger(durationSeconds) && durationSeconds >= 0 && durationSeconds < 60 && draftSeconds >= 60 && draftSeconds <= 1800;
  const plannedSeconds = hallPlanSeconds(day);
  const standings = hallStandings(day), scorers = hallScorers(day);
  const finishedCount = day.games.filter(g => g.status === 'finished').length;
  const teamsLocked = activeIndex >= 0;
  const gameKey = activeIndex >= 0 ? `${eventId}:${activeIndex}` : null;
  useEffect(() => {
    if (!open || loading || readOnly || !soundEnabled || !current || current.status !== 'running' || elapsed < matchSeconds || armedGame.current !== gameKey || soundedGame.current === gameKey) return;
    soundedGame.current = gameKey;
    if (audio.current?.state === 'running') {
      try { playSiren(audio.current); } catch { setSoundError('Sirene konnte nicht abgespielt werden. Bitte Ton testen.'); }
    } else setSoundError('Spielzeit abgelaufen. Ton ist nicht aktiv – bitte „Ton testen“ antippen.');
  }, [open, loading, readOnly, soundEnabled, current, elapsed, matchSeconds, gameKey]);
  const resetPlan = async () => {
    if (busy || readOnly || teamsLocked || dirty || configDirty) return;
    if (!window.confirm('Neuen Spielplan erstellen? Alle bisherigen Spiele, Tore und Ergebnisse dieses Hallenspieltags werden gelöscht. Die Mannschaften bleiben erhalten.')) return;
    const next = createHallDay(day.teams.length, day.format, day.total, day.pause, day.target, day.cycles);
    next.teams = structuredClone(day.teams);
    if (await persist(next)) { init(next); armedGame.current = null; soundedGame.current = null; }
  };
  const mutateGame = async (action: 'start' | 'pause' | 'finish' | 'undo' | 'goal', team?: number) => {
    if (dirty || configDirty || busy || loading || readOnly || goalPicker) return;
    const index = activeIndex >= 0 ? activeIndex : nextIndex;
    const next = action === 'start' && activeIndex < 0 ? prepareHallPlayers(day, index) : structuredClone(day);
    if (index < 0) return;
    const game = next.games[index], seconds = hallGameSeconds(next, game), time = hallElapsed(game, seconds);
    if (action === 'start') {
      if (!ready || unavailable.length || time >= seconds || (activeIndex < 0 && durationDirty)) return;
      if (soundEnabled) {
        void prepareSound().then(context => {
          if (context) armedGame.current = `${eventId}:${index}`;
        });
      }
      game.status = 'running'; game.runningSince = Date.now();
    } else if (action === 'pause') { game.elapsed = time; game.runningSince = null; game.status = 'paused'; }
    else if (action === 'finish') { if (!window.confirm('Spiel beenden und Ergebnis übernehmen?')) return; game.elapsed = time; game.runningSince = null; game.status = 'finished'; }
    else if (action === 'undo') game.goals.pop();
    else if (action === 'goal') {
      if (team !== undefined && [game.home, game.away].includes(team) && game.status === 'running' && time < seconds) setGoalPicker({ game: index, team, second: Math.floor(time) });
      return;
    }
    await persist(next);
    setOutgoing(null);
    setNow(Date.now());
  };
  const saveGoalScorer = async (scorerId?: string) => {
    if (!goalPicker || busy || saving.current || readOnly || dirty || configDirty) return;
    const next = structuredClone(day), game = next.games[goalPicker.game];
    if (!game || ![game.home, game.away].includes(goalPicker.team)) return;
    const scorerTeam = goalPicker.ownGoal ? (game.home === goalPicker.team ? game.away : game.home) : goalPicker.team;
    if (scorerId && !day.teams[scorerTeam].playerIds.includes(scorerId)) return;
    const goal = { team: goalPicker.team, second: goalPicker.second, ...(goalPicker.timeUnknown ? { timeUnknown: true } : {}), ...(goalPicker.ownGoal ? { ownGoal: true } : {}), ...(scorerId ? { scorerId, scorerName: names.get(scorerId) ?? 'Spieler' } : {}) };
    if (goalPicker.goal !== undefined) {
      if (!game.goals[goalPicker.goal]) return;
      game.goals[goalPicker.goal] = goal;
    } else {
      if (game.status !== 'running' && game.status !== 'paused' && game.status !== 'finished') return;
      game.goals.push(goal);
    }
    if (await persist(next)) setGoalPicker(null);
  };
  const removeFinishedGoal = async (gameIndex: number, goalIndex: number) => {
    if (readOnly || busy || saving.current || loading || dirty || configDirty || goalPicker || day.games[gameIndex]?.status !== 'finished') return;
    if (!window.confirm('Dieses Tor entfernen? Spielstand, Tabelle und Torschützenliste werden neu berechnet.')) return;
    const next = structuredClone(day);
    if (!next.games[gameIndex].goals[goalIndex]) return;
    next.games[gameIndex].goals.splice(goalIndex, 1);
    await persist(next);
  };
  const goalHistory = (gameIndex: number) => {
    const game = day.games[gameIndex];
    return <ol className="hall-match-goals" aria-label={`Tore Spiel ${gameIndex + 1}`}>
      {game.goals.length ? [...game.goals].reverse().map((goal, reverseIndex) => {
        const goalIndex = game.goals.length - 1 - reverseIndex;
        return <li key={goalIndex}>
          <span className="hall-goal-time">{goal.timeUnknown ? '–' : hallClock(goal.second)}</span>
          <Goal size={17} style={{ color: HALL_COLORS[goal.team] }} aria-hidden />
          <span className="hall-goal-player"><strong>{goal.ownGoal ? 'Eigentor · ' : ''}{goal.scorerName || (goal.scorerId ? names.get(goal.scorerId) : null) || (goal.ownGoal ? 'Ohne Spielerangabe' : 'Ohne Torschützen')}</strong><small>{day.teams[goal.team].name}</small></span>
          {!readOnly ? <button type="button" className="hall-match-text-button" disabled={busy || Boolean(goalPicker) || dirty || configDirty} aria-label={`Torschütze für Tor ${goalIndex + 1} in Spiel ${gameIndex + 1} ändern`} onClick={() => setGoalPicker({ game: gameIndex, team: goal.team, second: goal.second, timeUnknown: goal.timeUnknown, ownGoal: goal.ownGoal, goal: goalIndex })}>Ändern</button> : null}
          {!readOnly && game.status === 'finished' && correctingGame === gameIndex ? <button type="button" className="hall-match-text-button text-red-300" disabled={busy || Boolean(goalPicker) || dirty || configDirty} aria-label={`Tor ${goalIndex + 1} in Spiel ${gameIndex + 1} entfernen`} onClick={() => void removeFinishedGoal(gameIndex, goalIndex)}><Trash2 size={17} aria-hidden /></button> : null}
        </li>;
      }) : <li className="hall-match-empty">{game.status === 'finished' ? 'Keine Tore erfasst.' : 'Noch keine Tore · bereit für den Anpfiff.'}</li>}
    </ol>;
  };
  const saveDuration = async () => {
    if (busy || readOnly || activeIndex >= 0 || nextIndex < 0 || dirty || configDirty || !durationValid) return;
    try {
      const next = withHallGameDuration(day, nextIndex, draftSeconds);
      const overtime = hallPlanSeconds(next) - next.total;
      if (overtime > 0 && !window.confirm(`Der Spielplan dauert damit ${hallClock(overtime)} Minuten länger als die verfügbare Trainingszeit. Spielzeit trotzdem übernehmen?`)) return;
      await persist(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Spielzeit konnte nicht gespeichert werden.'); }
  };
  const gameTime = (index: number) => new Date(new Date(startsAt).getTime() + (day.games.slice(0, index).reduce((sum, game) => sum + hallGameSeconds(day, game), 0) + index * day.pause) * 1000).toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: day.games.slice(0, index).every(game => (hallGameSeconds(day, game) + day.pause) % 60 === 0) ? undefined : '2-digit' });
  return <Modal open={open} onClose={close} className="hall-training-modal" title={indoor ? "Hallenspieltag · Nur intern" : "Trainingsmatch · Nur intern"}>
    {loading ? <p role="status">Hallenspieltag wird geladen…</p> : <div className="space-y-4">
      <p className="flex items-center gap-2 text-[15px] text-white/60"><Lock className="h-4 w-4" aria-hidden />Interne Trainingsspiele · nur für Trainer</p>
      {error ? <div role="alert" className="rounded-xl border border-red-400/30 p-3 text-[16px] text-red-200"><p>{error}</p><button type="button" className={`${button} mt-2`} onClick={async () => { if ((dirty || configDirty) && !window.confirm('Änderungen verwerfen und gespeicherten Stand laden?')) return; try { setLoading(true); const row = await loadHallDay(eventId); if (row) { init(row.day); setRevision(row.revision); } setError(null); } catch { setError('Laden fehlgeschlagen. Bitte erneut versuchen.'); } finally { setLoading(false); } }}>Gespeicherten Stand laden</button></div> : null}
      {unavailable.length ? <p className="text-[16px] text-amber-200">{unavailable.length} eingeteilte Spieler sind nicht mehr als dabei markiert. Bitte Einteilung prüfen.</p> : null}
      <div className="hall-section-tabs" role="group" aria-label="Hallenspieltag Bereiche">{(['teams', 'games', 'table', 'times'] as const).map((key, i) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`${button} flex-1 px-2 ${tab === key ? 'sz-club-tab-active' : ''}`}>{['Teams', 'Spielplan', 'Tabelle', 'Zeiten'][i]}</button>)}</div>
      {tab === 'teams' ? <>
        <details className="hall-settings" open={!started && !saved}>
          <summary><Clock3 size={20} aria-hidden /><span>Zeit & Spielform<small>{count} Teams · {format} gegen {format} · {minutes} Min.</small></span><span className="hall-expand">⌄</span></summary>
        <fieldset disabled={readOnly || busy || started} className={`${TC_CARD} space-y-3 p-4 disabled:opacity-65`}>
          <legend className="sr-only">Zeit und Spielform</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[15px] text-white/70">Mannschaften<select className={input} value={count} onChange={e => changeTeamCount(Number(e.target.value))}><option value={2}>2 Teams</option><option value={3}>3 Teams</option><option value={4}>4 Teams</option></select></label>
            <label className="text-[15px] text-white/70">Spielform<select className={input} value={format} onChange={e => setFormat(Number(e.target.value) as HallDay['format'])}>{Array.from({ length: indoor ? 3 : 10 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} gegen {n}</option>)}</select></label>
            <label className="text-[15px] text-white/70">Gesamtzeit (Min.)<input className={input} type="number" min={15} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Wechselpause (Min.)<input className={input} type="number" min={0} max={5} step={0.5} value={pause} onChange={e => setPause(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Wunschspielzeit (Min.)<input className={input} type="number" min={2} max={20} value={target} onChange={e => setTarget(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Jeder gegen jeden<select className={input} value={cycles} onChange={e => setCycles(Number(e.target.value))}><option value={0}>Automatisch</option>{Array.from({ length: 8 }, (_, i) => <option value={i + 1} key={i}>{i + 1} Durchgänge</option>)}</select></label>
          </div>
          {preview ? <p className="text-[16px] leading-relaxed text-white/80">{preview.count} Spiele à <strong>{hallClock(preview.seconds)} Min.</strong> · {preview.cycles} Durchgänge<br />Jedes Team: {preview.gamesPerTeam} Spiele · {hallClock(preview.playPerTeam)} Min. Spielzeit<br />{preview.count - 1} Wechselpausen à {hallClock(pause * 60)} Min.{preview.buffer ? ` · ${hallClock(preview.buffer)} Min. Restpuffer` : ''}</p> : <p role="alert" className="text-red-200">{calculationError}</p>}
          <button type="button" disabled={!preview} className={`${button} w-full`} onClick={() => void generate()}>{saved ? 'Zeitplanung übernehmen' : 'Spielplan erstellen & speichern'}</button>
        </fieldset>
        </details>
        {firstPairingControl}
        {day.games.some(game => game.seconds !== undefined) ? <p className="text-[15px] text-white/60">Individuelle Spielzeiten stehen im Spielplan. Dadurch kann die Gesamtspielzeit der Teams unterschiedlich sein.</p> : null}
        {started ? <p className="text-[15px] text-white/60">Zeitplanung und Teamanzahl bleiben fest. Spieler und Teamnamen kannst du zwischen den Spielen ändern; bisherige Ergebnisse bleiben bei den Teams.</p> : null}
        <div className="hall-team-cards">{day.teams.map((team, i) => <details key={i} className="hall-settings hall-team-card" style={{ "--team-color": HALL_COLORS[i] } as React.CSSProperties}><summary><Shirt size={22} aria-hidden /><span>{team.name}<small>{team.playerIds.length} Spieler · {Math.min(day.format, team.playerIds.length)} Feld · {Math.max(0, team.playerIds.length - day.format)} Bank</small></span><span className="hall-expand">⌄</span></summary><div className="p-3"><label className="flex items-center gap-2"><Shirt className="h-6 w-6 shrink-0" style={{ color: HALL_COLORS[i] }} aria-hidden /><span className="sr-only">Name Team {i + 1}</span><input className={`${input} min-w-0 px-2 font-bold`} maxLength={32} disabled={readOnly || teamsLocked || busy} value={team.name} onChange={e => setDay(prev => ({ ...prev, teams: prev.teams.map((t, n) => n === i ? { ...t, name: e.target.value } : t) }))} /></label><p className="mt-2 text-[15px] text-white/65">{team.playerIds.length} Spieler {team.playerIds.length > day.format ? '· mit Wechselspielern' : ''}</p><p className="mt-1 break-words text-[15px] text-white/80">{team.playerIds.map(id => names.get(id) ?? 'Nicht mehr im Kader').join(' · ') || 'Noch keine Spieler'}</p></div></details>)}</div>
        {teamsLocked ? <p className="text-[15px] text-amber-200">Bitte zuerst das aktuelle Spiel beenden. Danach kannst du die Mannschaften umstellen.</p> : null}
        {!teamsLocked && !readOnly ? <>
          <button type="button" disabled={busy} className={`${button} w-full`} onClick={() => { if (day.teams.some(t => t.playerIds.length) && !window.confirm('Vorhandene Einteilung neu verteilen?')) return; const next = structuredClone(day); next.teams.forEach(t => { t.playerIds = []; }); availableIds.forEach((id, i) => next.teams[i % next.teams.length].playerIds.push(id)); setDay(next); }}>Zugesagte Spieler gleichmäßig verteilen</button>
          <p className="text-[15px] text-white/60">Nach Spielerzahl verteilt. Du kannst die Teams danach frei anpassen.</p>
          <details className="hall-settings" open={!started}><summary><Shirt size={20} aria-hidden /><span>Spieler einteilen<small>Team antippen · aktive Auswahl in Teamfarbe</small></span><span className="hall-expand">⌄</span></summary><div className="space-y-2 p-3">{[...new Set([...availableIds, ...day.teams.flatMap(t => t.playerIds)])].map(id => <div key={id} className="rounded-xl border border-white/10 p-3"><p className="mb-3 text-[16px] font-semibold">{names.get(id) ?? 'Spieler'}{!availableIds.includes(id) ? ' · abgemeldet' : ''}</p><div className="hall-team-options" role="group" aria-label={`Team für ${names.get(id) ?? 'Spieler'}`}>{day.teams.map((team, i) => <button key={i} type="button" className={`hall-team-option ${team.playerIds.includes(id) ? 'is-selected' : ''}`} style={{ '--team-color': HALL_COLORS[i] } as React.CSSProperties} disabled={busy} aria-pressed={team.playerIds.includes(id)} onClick={() => assign(id, team.playerIds.includes(id) ? -1 : i)}><Shirt size={17} aria-hidden />{team.name}</button>)}</div></div>)}</div></details>
          <button type="button" disabled={busy || !dirty || configDirty || (started && !ready)} className={`${button} w-full sz-club-tab-active`} onClick={() => void persist(day)}>{busy ? 'Speichert…' : 'Mannschaften speichern'}</button>
          {!ready ? <p className="text-[15px] text-white/60">Zum Start alle Zusagen zuteilen: Jedes Team braucht mindestens {day.format} verfügbare Spieler. {started ? 'Bitte vor dem Speichern alle Teams vollständig einteilen.' : 'Eine unvollständige Einteilung kannst du als Entwurf speichern.'}</p> : null}
          {started ? <button type="button" disabled={busy || dirty || configDirty} className={`${button} w-full`} onClick={() => void resetPlan()}>Neuen Spielplan erstellen</button> : null}
        </> : null}
      </> : null}
      {tab === 'games' ? <>
        {goalPicker && !readOnly ? <section ref={scorerPanel} tabIndex={-1} className="hall-scorer-picker" role="region" aria-label="Torschützen auswählen">
          <div className="hall-scorer-heading"><span style={{ color: HALL_COLORS[goalPicker.team] }}><Goal size={22} aria-hidden /> {day.teams[goalPicker.team].name}</span><span>{goalPicker.timeUnknown ? 'Nachgetragen' : hallClock(goalPicker.second)}</span></div>
          <h3>{goalPicker.goal === undefined ? 'Wer hat getroffen?' : 'Torschützen ergänzen'}</h3>
          <p>{goalPicker.goal === undefined ? (day.games[goalPicker.game].status === 'finished' ? 'Tor nachtragen. Die ursprüngliche Torzeit ist nicht erfasst.' : 'Torzeit ist vorgemerkt. Die Spieluhr läuft weiter.') : 'Spielstand und Torzeit bleiben erhalten.'}</p>
          <button type="button" className="hall-match-button" aria-pressed={Boolean(goalPicker.ownGoal)} disabled={busy} onClick={() => setGoalPicker({ ...goalPicker, ownGoal: !goalPicker.ownGoal })}>Eigentor {goalPicker.ownGoal ? '✓' : ''}</button>
          {goalPicker.ownGoal ? <p>Eigentor des Gegners · zählt für {day.teams[goalPicker.team].name}. Kein Treffer in der Torschützenwertung.</p> : null}
          <div className="hall-scorer-options">{day.teams[goalPicker.ownGoal ? (day.games[goalPicker.game].home === goalPicker.team ? day.games[goalPicker.game].away : day.games[goalPicker.game].home) : goalPicker.team].playerIds.map(id => <button type="button" key={id} disabled={busy} onClick={() => void saveGoalScorer(id)}><span style={{ color: HALL_COLORS[goalPicker.team] }}><Shirt size={21} aria-hidden /></span>{names.get(id) ?? 'Spieler'}</button>)}</div>
          <button type="button" className="hall-match-button hall-match-primary" disabled={busy} onClick={() => void saveGoalScorer()}>Ohne Torschützen speichern</button>
          <button type="button" className="hall-match-text-button" disabled={busy} onClick={() => setGoalPicker(null)}>Abbrechen</button>
        </section> : null}
        {current ? <section className="hall-match-screen" aria-label="Aktuelles Trainingsspiel">
          <header className="hall-match-topline"><span className={`hall-match-status ${current.status === 'running' && elapsed < matchSeconds ? 'is-running' : ''}`}><i />{elapsed >= matchSeconds ? 'Abpfiff' : current.status === 'running' ? 'Live' : 'Pause'}</span><span>Spiel {activeIndex + 1} <span className="hall-match-muted">/ {day.games.length}</span></span><span>{day.format} gegen {day.format}</span></header>
          <div className="hall-match-scoreboard">
            {[current.home, current.away].map((team, side) => <React.Fragment key={team}>
              {side === 1 ? <span className="hall-match-score-divider" aria-hidden>:</span> : null}
              <div className="hall-match-team" style={{ '--team-color': HALL_COLORS[team] } as React.CSSProperties}><span className="hall-match-shirt"><Shirt size={30} strokeWidth={1.8} aria-hidden /></span><h3>{day.teams[team].name}</h3><strong className="hall-match-score">{hallScore(current, team)}</strong></div>
            </React.Fragment>)}
          </div>
          <div className="hall-match-clock"><span className="hall-match-eyebrow">VERBLEIBENDE SPIELZEIT</span><strong role="timer" aria-label="Verbleibende Spielzeit">{hallClock(Math.ceil(Math.max(0, matchSeconds - elapsed)))}</strong><span>{hallClock(elapsed)} gespielt · {hallClock(matchSeconds)} Min.</span></div>
          <div className="hall-match-progress" role="progressbar" aria-label="Gespielte Zeit" aria-valuemin={0} aria-valuemax={matchSeconds} aria-valuenow={Math.floor(elapsed)}><span style={{ width: `${Math.min(100, elapsed / matchSeconds * 100)}%` }} /></div>
          {elapsed >= matchSeconds ? <p role="status" className="hall-match-expired">Spielzeit abgelaufen · Spiel beenden</p> : null}
          {!readOnly ? <div className="hall-match-actions">
            <div className="hall-match-goal-actions">{[current.home, current.away].map(team => <button key={team} className="hall-match-goal-button" style={{ '--team-color': HALL_COLORS[team] } as React.CSSProperties} type="button" disabled={busy || Boolean(goalPicker) || current.status !== 'running' || elapsed >= matchSeconds} onClick={() => void mutateGame('goal', team)}><Goal size={22} aria-hidden /><span>+ Tor {day.teams[team].name}</span></button>)}</div>
            <div className="hall-match-secondary-actions"><button className="hall-match-button" type="button" disabled={busy || Boolean(goalPicker) || elapsed >= matchSeconds} onClick={() => void mutateGame(current.status === 'running' ? 'pause' : 'start')}>{current.status === 'running' ? <Pause size={17} aria-hidden /> : <Play size={17} aria-hidden />}{current.status === 'running' ? 'Pause' : 'Weiter'}</button><button type="button" className="hall-match-button" aria-label="Letztes Tor zurücknehmen" disabled={busy || Boolean(goalPicker) || !current.goals.length} onClick={() => void mutateGame('undo')}><Undo2 size={17} aria-hidden /><span>Tor zurück</span></button></div>
            <button type="button" className="hall-match-button hall-match-finish" disabled={busy || Boolean(goalPicker)} onClick={() => void mutateGame('finish')}>Spiel beenden</button>
          </div> : null}
          <div className="hall-match-history"><h4>Spielverlauf <span>{current.goals.length} Tore</span></h4>{goalHistory(activeIndex)}</div>
        </section> : null}
        {!readOnly ? <div className="hall-sound-toolbar"><button type="button" className={`hall-sound-round ${soundEnabled ? 'is-on' : ''}`} aria-label={`Schlusssirene ${soundEnabled ? 'ausschalten' : 'einschalten'}`} aria-pressed={soundEnabled} onClick={async () => { if (soundEnabled) { setSoundEnabled(false); armedGame.current = null; } else { setSoundEnabled(true); const context = await prepareSound(); if (context && current?.status === 'running' && elapsed < matchSeconds) armedGame.current = gameKey; } }}>{soundEnabled ? <Volume2 size={23} aria-hidden /> : <VolumeX size={23} aria-hidden />}</button><div><strong>Schlusssirene {soundEnabled ? 'ein' : 'aus'}</strong><p>App geöffnet und Bildschirm eingeschaltet lassen.</p></div><button type="button" className="hall-match-text-button" onClick={async () => { const context = await prepareSound(); if (context) { playSiren(context); if (soundEnabled && current?.status === 'running') armedGame.current = gameKey; } }}>Ton testen</button>{soundError ? <p role="status">{soundError}</p> : null}</div> : null}
        {current ? <section className="hall-player-panel"><h3>Aufstellung & Wechsel</h3>{!current.participation ? <p>Für dieses bereits gestartete Spiel wurden keine Einsatzzeiten erfasst. Erfassung beginnt ab dem nächsten Spiel.</p> : [current.home,current.away].map(team => { const p = current.participation![team], on = p.stints[p.stints.length-1].on; return <div key={team} className="hall-player-team" style={{ '--team-color': HALL_COLORS[team] } as React.CSSProperties}><h4>{day.teams[team].name} · {on.length} am Feld</h4><div className="hall-player-chips">{on.map(id => <button key={id} type="button" aria-pressed={outgoing === id} disabled={readOnly || busy || elapsed >= matchSeconds} onClick={() => setOutgoing(outgoing === id ? null : id)}>{names.get(id) ?? 'Spieler'}{outgoing === id ? ' · Raus' : ''}</button>)}</div><p>Bank · zuerst Spieler am Feld, dann Ersatz antippen</p><div className="hall-player-chips">{p.roster.filter(id => !on.includes(id)).map(id => <div key={id}><button type="button" disabled={readOnly || busy || !outgoing || !on.includes(outgoing) || elapsed >= matchSeconds} onClick={async () => { if (!outgoing || dirty || configDirty) return; if (await persist(changeHallPlayers(day,activeIndex,team,on.map(x => x === outgoing ? id : x)))) setOutgoing(null); }}>{names.get(id) ?? 'Spieler'} · Rein</button>{on.length === day.format ? <button type="button" disabled={readOnly || busy || elapsed >= matchSeconds} aria-label={`Zusatzspieler ${names.get(id) ?? id}`} onClick={() => { if (!dirty && !configDirty) void persist(changeHallPlayers(day,activeIndex,team,[...on,id])); }}>+ Zusatzspieler</button> : null}</div>)}</div>{on.length > day.format && outgoing && on.includes(outgoing) ? <button type="button" className="hall-match-button" disabled={readOnly || busy || elapsed >= matchSeconds} onClick={async () => { if (dirty || configDirty) return; if (await persist(changeHallPlayers(day,activeIndex,team,on.filter(x => x !== outgoing)))) setOutgoing(null); }}>Zusatzspieler auf Bank</button> : null}</div>; })}</section> : null}
        {nextIndex >= 0 && activeIndex < 0 ? <div className="hall-next-match">
          <span className="hall-match-eyebrow">NÄCHSTES SPIEL · {nextIndex + 1} / {day.games.length}</span>
          <h3>{day.teams[day.games[nextIndex].home].name} <span>–</span> {day.teams[day.games[nextIndex].away].name}</h3>
          {firstPairingControl}
          {!readOnly ? <div className="hall-duration-editor">
            <label htmlFor="hall-game-minutes"><Clock3 size={16} aria-hidden />Spielzeit vor Anpfiff</label>
            <div className="hall-duration-fields">
              <button type="button" aria-label="Spielzeit um eine Minute verkürzen" disabled={busy || draftSeconds - 60 < 60} onClick={() => setDurationMinutes(value => value - 1)}>−</button>
              <label><input id="hall-game-minutes" aria-label="Spielzeit Minuten" type="number" min={1} max={30} value={durationMinutes} disabled={busy} onChange={e => setDurationMinutes(Number(e.target.value))} /><span>Min.</span></label><span>:</span>
              <label><select aria-label="Spielzeit Sekunden" value={durationSeconds} disabled={busy} onChange={e => setDurationSeconds(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i * 5).map(value => <option key={value} value={value}>{String(value).padStart(2, '0')}</option>)}</select><span>Sek.</span></label>
              <button type="button" aria-label="Spielzeit um eine Minute verlängern" disabled={busy || draftSeconds + 60 > 1800} onClick={() => setDurationMinutes(value => value + 1)}>+</button>
            </div>
            {durationDirty ? <button type="button" className="hall-match-button" disabled={busy || !durationValid || dirty || configDirty} onClick={() => void saveDuration()}>Spielzeit übernehmen</button> : <p>Gespeichert: {hallClock(nextSeconds)} Minuten · nur für dieses Spiel</p>}
            {!durationValid ? <p role="alert">Bitte 1:00 bis 30:00 Minuten wählen.</p> : null}
          </div> : <p>Spielzeit: {hallClock(nextSeconds)} Min.</p>}
          <button type="button" className="hall-match-button hall-match-primary" disabled={busy || dirty || configDirty || durationDirty || readOnly || !ready} onClick={() => void mutateGame('start')}>Spiel starten</button>
          {(!ready || dirty || configDirty) ? <p className="text-[15px] text-amber-200">Bitte zuerst Teams vollständig einteilen und speichern.</p> : null}
        </div> : null}
        {nextIndex < 0 && !current ? <p role="status" className="text-[18px] font-bold text-emerald-300">Hallenspieltag abgeschlossen ✓</p> : null}
        {plannedSeconds > day.total ? <p className="hall-match-expired">Geplante Dauer {hallClock(plannedSeconds)} Min. · {hallClock(plannedSeconds - day.total)} Min. über der verfügbaren Trainingszeit</p> : null}
        <p className="text-[15px] text-white/60">Startaufstellung automatisch nach geringster erfasster Spielzeit; weitere Spieler bleiben auf der Teambank. Geplante Zeiten. Bei Verzögerungen startest du jedes Spiel selbst.</p>
        <div className="hall-match-fixtures">{day.games.map((g, i) => <details key={i} className="hall-match-fixture">
          <summary><span className="hall-fixture-number">{i + 1}</span><span className="hall-fixture-teams"><span><span style={{ color: HALL_COLORS[g.home] }}>{day.teams[g.home].name}</span> <span className="text-white/35">–</span> <span style={{ color: HALL_COLORS[g.away] }}>{day.teams[g.away].name}</span></span><small>{gameTime(i)} · {hallClock(hallGameSeconds(day, g))} Min. · {g.status === 'finished' ? 'Beendet' : g.status === 'running' ? 'Live' : g.status === 'paused' ? 'Pause' : 'Geplant'}</small></span><strong>{g.status !== 'pending' ? `${hallScore(g, g.home)}:${hallScore(g, g.away)}` : '–:–'}</strong></summary>
          {!readOnly && g.status === 'finished' ? <div className="space-y-3 p-3">
            <button type="button" className="hall-match-button w-full" aria-label={`Ergebnis von Spiel ${i + 1} korrigieren`} aria-expanded={correctingGame === i} disabled={busy || Boolean(goalPicker) || dirty || configDirty} onClick={() => setCorrectingGame(correctingGame === i ? null : i)}>{correctingGame === i ? 'Korrektur schließen' : 'Ergebnis korrigieren'}</button>
            {g.elapsed < hallGameSeconds(day, g) ? <button type="button" className="hall-match-button w-full" disabled={busy || Boolean(goalPicker) || dirty || configDirty} onClick={async () => { if (window.confirm(`Spiel ${i + 1}: volle Spielzeit von ${hallClock(hallGameSeconds(day, g))} Minuten anrechnen? Die Spielzeiten werden neu berechnet.`)) await persist(creditHallFullDuration(day, i)); }}>Volle Spielzeit anrechnen · {hallClock(hallGameSeconds(day, g))} Min.</button> : null}
            {correctingGame === i ? <><p className="text-[14px] text-white/60">Fehlendes Tor nachtragen oder ein falsches Tor unten entfernen. Tabelle und Torschützenliste passen sich automatisch an.</p><div className="flex flex-wrap gap-2">{[g.home, g.away].map(team => <button key={team} type="button" className="hall-match-button flex-1" disabled={busy || Boolean(goalPicker) || dirty || configDirty || g.goals.length >= 200} onClick={() => setGoalPicker({ game: i, team, second: 0, timeUnknown: true })}>+ Tor {day.teams[team].name}</button>)}</div></> : null}
          </div> : null}
          {goalHistory(i)}
        </details>)}</div>
      </> : null}
      {tab === 'times' ? <section className="hall-player-panel">
        <h3>Spielzeiten · Spieler</h3><p>Aus den Trainingsmatches · geringste Einsatzzeit zuerst</p>
        {hallPlayerTimes(day, now).untracked > 0 ? <p className="hall-time-note">Ältere Spiele: Bei Teams ohne Bank wird die gespielte Matchzeit anhand der aktuellen Einteilung zugeordnet (≈). Frühere Wechsel sind nicht gespeichert. Bei Teams mit Bank bleibt die individuelle Zeit unvollständig (—).</p> : null}
        {hallPlayerTimes(day, now).players.map(p => <div className="hall-player-time" key={p.id}><span>{names.get(p.id) ?? 'Spieler'}<small>{p.incomplete ? 'Unvollständig · frühere Wechsel fehlen' : p.estimated ? 'Aus Matchdauer · aktuelle Teameinteilung' : 'Mit Wechseln erfasst'}</small></span><strong>{p.incomplete ? (p.seconds > 0 ? `≥ ${hallClock(p.seconds)}` : '—') : `${p.estimated ? '≈ ' : ''}${hallClock(p.seconds)}`}<small>Min.</small></strong></div>)}
        <details className="hall-settings mt-3"><summary><Clock3 size={20} aria-hidden /><span>Spielzeiten je Match<small>Gespielte Dauer aus dem Trainingsmatch</small></span><span className="hall-expand">⌄</span></summary>{day.games.map((game, i) => game.status !== 'pending' ? <div key={i} className="hall-player-time px-3"><span>{day.teams[game.home].name} – {day.teams[game.away].name}<small>Spiel {i + 1}</small></span><strong>{hallClock(hallElapsed(game, hallGameSeconds(day, game), now))}<small>Min.</small></strong></div> : null)}</details>
      </section> : null}
      {tab === 'table' ? <div className="hall-results">
        <header className="hall-results-heading"><span><Trophy size={18} aria-hidden />Trainingstabelle</span><small>{finishedCount} / {day.games.length} Spiele beendet</small></header>
        {finishedCount > 0 && standings[0] ? <div className="hall-results-leader"><Trophy size={26} aria-hidden /><div><small>Tabellenführer</small><strong style={{ color: HALL_COLORS[standings[0].id] }}>{standings[0].name}</strong></div><b>{standings[0].points}<small>Punkte</small></b></div> : null}
        <div className="hall-standings-wrap"><table className="hall-standings"><caption className="sr-only">Interne Trainingstabelle · beendete Spiele</caption><thead><tr><th scope="col"><span className="sr-only">Platz</span>#</th><th scope="col">Team</th><th scope="col">Sp.</th><th scope="col">Tore</th><th scope="col">Diff.</th><th scope="col">Pkt.</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.id} className={index === 0 && finishedCount ? 'is-leader' : ''}><td><span className="hall-rank">{index + 1}</span></td><th scope="row"><span className="hall-table-team"><i style={{ background: HALL_COLORS[row.id] }} />{row.name}</span></th><td>{row.played}</td><td>{row.goals}:{row.against}</td><td className="hall-goal-diff">{row.goals - row.against > 0 ? '+' : ''}{row.goals - row.against}</td><td><strong className="hall-points">{row.points}</strong></td></tr>)}</tbody></table></div>
        <p className="hall-results-note">Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte</p>
        <section className="hall-scorers"><header className="hall-results-heading"><span><Crown size={19} aria-hidden />Torschützen</span><small>Beendete Spiele</small></header>
          {scorers.players.length ? <>
            <div className="hall-scorer-king"><Crown size={25} aria-hidden /><div><small>{scorers.players.filter(row => row.rank === 1).length > 1 ? 'Torschützenkönige' : 'Torschützenkönig'}</small><strong>{scorers.players.filter(row => row.rank === 1).map(row => row.name).join(' · ')}</strong></div><b>{scorers.players[0].goals}<small>{scorers.players[0].goals === 1 ? 'Tor' : 'Tore'}</small></b></div>
            <ol className="hall-scorer-ranking">{scorers.players.map(row => <li key={row.id}><span className="hall-rank">{row.rank}</span><span className="hall-scorer-jersey" style={{ color: HALL_COLORS[row.teams[0]] }}><Shirt size={21} aria-hidden /></span><div><strong>{row.name}</strong><small>{row.teams.map(team => day.teams[team].name).join(' · ')}</small></div><b>{row.goals}<small>{row.goals === 1 ? 'Tor' : 'Tore'}</small></b></li>)}</ol>
          </> : <p className="hall-scorers-empty">Noch keine Torschützen aus beendeten Spielen. Beim Tor einen Spieler auswählen oder im Spielverlauf ergänzen.</p>}
          {scorers.unassigned ? <p className="hall-scorers-unassigned">{scorers.unassigned} {scorers.unassigned === 1 ? 'Tor noch ohne Torschützen' : 'Tore noch ohne Torschützen'} · im Spielplan nachtragen</p> : null}
        </section>
      </div> : null}
    </div>}
  </Modal>;
}
