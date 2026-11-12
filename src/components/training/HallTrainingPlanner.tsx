import React, { useEffect, useRef, useState } from 'react';
import { Lock, Play, Pause, Shirt, Undo2 } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { useDemoMode } from '../../demo/DemoContext';
import { calculateHallSchedule, createHallDay, hallClock, hallElapsed, hallReady, hallScore, hallStandings, HALL_COLORS, HALL_NAMES, type HallDay } from '../../lib/hallTraining';
import { loadHallDay, saveHallDay } from '../../lib/hallTrainingStore';
import { TC_CARD } from '../tournament/tournamentCenterStyles';

type Player = { id: string; display_name?: string | null; name?: string | null; first_name?: string | null; last_name?: string | null };
const input = 'min-h-11 w-full rounded-xl border border-white/15 bg-[#101014] px-3 text-[16px] text-white';
const button = 'sz-club-event-action min-h-12 rounded-full border px-4 py-2 text-[16px] font-bold text-white disabled:opacity-40 touch-manipulation';
function playerName(p: Player) { return p.display_name || p.name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Spieler'; }

export function HallTrainingPlanner({ eventId, startsAt, players, availableIds, open, onClose, onReadyChange, readOnly = false, defaultMinutes = 60 }: {
  eventId: string; startsAt: string; players: Player[]; availableIds: string[]; open: boolean; onClose: () => void; onReadyChange: (ready: boolean) => void; readOnly?: boolean; defaultMinutes?: number;
}) {
  const demo = useDemoMode();
  const [day, setDay] = useState<HallDay>(() => createHallDay(3, 3, Math.max(15, Math.min(180, defaultMinutes)) * 60));
  const [saved, setSaved] = useState<HallDay | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'teams' | 'games' | 'table'>('teams');
  const [now, setNow] = useState(Date.now());
  const [count, setCount] = useState(3), [format, setFormat] = useState<3 | 4>(3), [minutes, setMinutes] = useState(defaultMinutes), [pause, setPause] = useState(2), [target, setTarget] = useState(8), [cycles, setCycles] = useState(0);
  const saving = useRef(false);
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
    const empty = createHallDay(3, 3, Math.max(15, Math.min(180, defaultMinutes)) * 60);
    setDay(empty); setCount(3); setFormat(3); setMinutes(empty.total / 60); setPause(2); setTarget(8); setCycles(0);
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
  const close = () => { if (busy) return; if ((dirty || configDirty) && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return; if (saved) init(structuredClone(saved)); onClose(); };
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
    if (started || readOnly || busy || ![3, 4].includes(nextCount)) return;
    if (nextCount < day.teams.length && day.teams.slice(nextCount).some(team => team.playerIds.length) && !window.confirm('Die Spieler der entfernten Mannschaft werden wieder nicht zugeteilt. Fortfahren?')) return;
    setCount(nextCount);
    setDay(previous => ({ ...previous, teams: Array.from({ length: nextCount }, (_, i) => previous.teams[i] ?? { name: HALL_NAMES[i], playerIds: [] }) }));
  };
  const assign = (id: string, team: number) => setDay(prev => ({ ...prev, teams: prev.teams.map((t, i) => ({ ...t, playerIds: [...t.playerIds.filter(x => x !== id), ...(i === team ? [id] : [])] })) }));
  const activeIndex = day.games.findIndex(g => g.status === 'running' || g.status === 'paused');
  const nextIndex = day.games.findIndex(g => g.status === 'pending');
  const current = activeIndex >= 0 ? day.games[activeIndex] : null;
  const elapsed = current ? hallElapsed(current, day.seconds, now) : 0;
  const mutateGame = async (action: 'start' | 'pause' | 'finish' | 'undo' | 'goal', team?: number) => {
    if (dirty || configDirty || busy || loading || readOnly) return;
    const next = structuredClone(day), index = activeIndex >= 0 ? activeIndex : nextIndex;
    if (index < 0) return;
    const game = next.games[index], time = hallElapsed(game, next.seconds);
    if (action === 'start') {
      if ((!started && !ready) || unavailable.length || time >= day.seconds) return;
      game.status = 'running'; game.runningSince = Date.now();
    } else if (action === 'pause') { game.elapsed = time; game.runningSince = null; game.status = 'paused'; }
    else if (action === 'finish') { if (!window.confirm('Spiel beenden und Ergebnis übernehmen?')) return; game.elapsed = time; game.runningSince = null; game.status = 'finished'; }
    else if (action === 'undo') game.goals.pop();
    else if (action === 'goal' && team !== undefined && game.status === 'running' && time < day.seconds) game.goals.push({ team, second: Math.floor(time) });
    await persist(next);
  };
  const gameTime = (index: number) => new Date(new Date(startsAt).getTime() + index * (day.seconds + day.pause) * 1000).toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: (day.seconds + day.pause) % 60 === 0 ? undefined : '2-digit' });
  return <Modal open={open} onClose={close} title="Hallenspieltag · Nur intern">
    {loading ? <p role="status">Hallenspieltag wird geladen…</p> : <div className="space-y-4">
      <p className="flex items-center gap-2 text-[15px] text-white/60"><Lock className="h-4 w-4" aria-hidden />Interne Trainingsspiele · nur für Trainer</p>
      {error ? <div role="alert" className="rounded-xl border border-red-400/30 p-3 text-[16px] text-red-200"><p>{error}</p><button type="button" className={`${button} mt-2`} onClick={async () => { if ((dirty || configDirty) && !window.confirm('Änderungen verwerfen und gespeicherten Stand laden?')) return; try { setLoading(true); const row = await loadHallDay(eventId); if (row) { init(row.day); setRevision(row.revision); } setError(null); } catch { setError('Laden fehlgeschlagen. Bitte erneut versuchen.'); } finally { setLoading(false); } }}>Gespeicherten Stand laden</button></div> : null}
      {unavailable.length ? <p className="text-[16px] text-amber-200">{unavailable.length} eingeteilte Spieler sind nicht mehr als dabei markiert. Bitte Einteilung prüfen.</p> : null}
      <div className="flex gap-1" role="group" aria-label="Hallenspieltag Bereiche">{(['teams', 'games', 'table'] as const).map((key, i) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`${button} flex-1 px-2 ${tab === key ? 'sz-club-tab-active' : ''}`}>{['Teams', 'Spielplan', 'Tabelle'][i]}</button>)}</div>
      {tab === 'teams' ? <>
        <fieldset disabled={readOnly || busy || started} className={`${TC_CARD} space-y-3 p-4 disabled:opacity-65`}>
          <legend className="sr-only">Zeit und Spielform</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[15px] text-white/70">Mannschaften<select className={input} value={count} onChange={e => changeTeamCount(Number(e.target.value))}><option value={3}>3 Teams</option><option value={4}>4 Teams</option></select></label>
            <label className="text-[15px] text-white/70">Spielform<select className={input} value={format} onChange={e => setFormat(Number(e.target.value) as 3 | 4)}><option value={3}>3 gegen 3</option><option value={4}>4 gegen 4</option></select></label>
            <label className="text-[15px] text-white/70">Gesamtzeit (Min.)<input className={input} type="number" min={15} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Wechselpause (Min.)<input className={input} type="number" min={0} max={5} step={0.5} value={pause} onChange={e => setPause(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Wunschspielzeit (Min.)<input className={input} type="number" min={2} max={20} value={target} onChange={e => setTarget(Number(e.target.value))} /></label>
            <label className="text-[15px] text-white/70">Jeder gegen jeden<select className={input} value={cycles} onChange={e => setCycles(Number(e.target.value))}><option value={0}>Automatisch</option>{Array.from({ length: 8 }, (_, i) => <option value={i + 1} key={i}>{i + 1} Durchgänge</option>)}</select></label>
          </div>
          {preview ? <p className="text-[16px] leading-relaxed text-white/80">{preview.count} Spiele à <strong>{hallClock(preview.seconds)} Min.</strong> · {preview.cycles} Durchgänge<br />Jedes Team: {preview.gamesPerTeam} Spiele · {hallClock(preview.playPerTeam)} Min. Spielzeit<br />{preview.count - 1} Wechselpausen à {hallClock(pause * 60)} Min.{preview.buffer ? ` · ${hallClock(preview.buffer)} Min. Restpuffer` : ''}</p> : <p role="alert" className="text-red-200">{calculationError}</p>}
          <button type="button" disabled={!preview} className={`${button} w-full`} onClick={() => void generate()}>{saved ? 'Zeitplanung übernehmen' : 'Spielplan erstellen & speichern'}</button>
        </fieldset>
        {started ? <p className="text-[15px] text-white/60">Der Spieltag läuft. Zeitplanung und Mannschaften bleiben für diese Spiele fest.</p> : null}
        <div className="grid grid-cols-2 gap-2">{day.teams.map((team, i) => <div key={i} className={`${TC_CARD} p-3`}><label className="flex items-center gap-2"><Shirt className="h-6 w-6 shrink-0" style={{ color: HALL_COLORS[i] }} aria-hidden /><span className="sr-only">Name Team {i + 1}</span><input className={`${input} min-w-0 px-2 font-bold`} maxLength={32} disabled={readOnly || started || busy} value={team.name} onChange={e => setDay(prev => ({ ...prev, teams: prev.teams.map((t, n) => n === i ? { ...t, name: e.target.value } : t) }))} /></label><p className="mt-2 text-[15px] text-white/65">{team.playerIds.length} Spieler {team.playerIds.length > day.format ? '· mit Wechselspielern' : ''}</p><p className="mt-1 break-words text-[15px] text-white/80">{team.playerIds.map(id => names.get(id) ?? 'Nicht mehr im Kader').join(' · ') || 'Noch keine Spieler'}</p></div>)}</div>
        {!started && !readOnly ? <>
          <button type="button" disabled={busy} className={`${button} w-full`} onClick={() => { if (day.teams.some(t => t.playerIds.length) && !window.confirm('Vorhandene Einteilung neu verteilen?')) return; const next = structuredClone(day); next.teams.forEach(t => { t.playerIds = []; }); availableIds.forEach((id, i) => next.teams[i % next.teams.length].playerIds.push(id)); setDay(next); }}>Zugesagte Spieler gleichmäßig verteilen</button>
          <p className="text-[15px] text-white/60">Nach Spielerzahl verteilt. Du kannst die Teams danach frei anpassen.</p>
          <div className="space-y-2">{[...new Set([...availableIds, ...day.teams.flatMap(t => t.playerIds)])].map(id => <label key={id} className="flex flex-col items-stretch gap-2 rounded-xl border border-white/10 p-3"><span className="min-w-0 flex-1 text-[16px] font-semibold">{names.get(id) ?? 'Spieler'}{!availableIds.includes(id) ? ' · abgemeldet' : ''}</span><select className={`${input} !w-full`} disabled={busy} value={day.teams.findIndex(t => t.playerIds.includes(id))} onChange={e => assign(id, Number(e.target.value))}><option value={-1}>Nicht zugeteilt</option>{day.teams.map((team, i) => <option value={i} key={i}>{team.name}</option>)}</select></label>)}</div>
          <button type="button" disabled={busy || !dirty || configDirty} className={`${button} w-full sz-club-tab-active`} onClick={() => void persist(day)}>{busy ? 'Speichert…' : 'Mannschaften speichern'}</button>
          {!ready ? <p className="text-[15px] text-white/60">Zum Start alle Zusagen zuteilen: Jedes Team braucht mindestens {day.format} verfügbare Spieler. Eine unvollständige Einteilung kannst du als Entwurf speichern.</p> : null}
        </> : null}
      </> : null}
      {tab === 'games' ? <>
        {current ? <section className={`${TC_CARD} space-y-3 p-4`}>
          <h3 className="text-[18px] font-bold">Interner Ticker · Spiel {activeIndex + 1} von {day.games.length}</h3>
          <p className="text-center text-[22px] font-black"><span style={{ color: HALL_COLORS[current.home] }}>{day.teams[current.home].name}</span> {hallScore(current, current.home)} : {hallScore(current, current.away)} <span style={{ color: HALL_COLORS[current.away] }}>{day.teams[current.away].name}</span></p>
          <p className="text-center text-[32px] font-black tabular-nums" role="timer">{hallClock(elapsed)} / {hallClock(day.seconds)}</p>
          {elapsed >= day.seconds ? <p role="status" className="text-center text-amber-200">Spielzeit abgelaufen · Spiel beenden</p> : null}
          {!readOnly ? <><div className="flex flex-wrap gap-2"><button className={button} type="button" disabled={busy || elapsed >= day.seconds} onClick={() => void mutateGame(current.status === 'running' ? 'pause' : 'start')}>{current.status === 'running' ? <Pause className="mr-1 inline h-4 w-4" /> : <Play className="mr-1 inline h-4 w-4" />}{current.status === 'running' ? 'Pause' : 'Weiter'}</button>{[current.home, current.away].map(i => <button key={i} className={`${button} flex-1`} type="button" disabled={busy || current.status !== 'running' || elapsed >= day.seconds} onClick={() => void mutateGame('goal', i)}>+ Tor {day.teams[i].name}</button>)}</div>
            <button type="button" className={`${button} w-full`} disabled={busy || !current.goals.length} onClick={() => void mutateGame('undo')}><Undo2 className="mr-2 inline h-4 w-4" aria-hidden />Letztes Tor zurücknehmen</button>
            <button type="button" className={`${button} sz-club-tab-active w-full`} disabled={busy} onClick={() => void mutateGame('finish')}>Spiel beenden</button></> : null}
          <ol className="space-y-1 text-[15px] text-white/70">{[...current.goals].reverse().map((goal, i) => <li key={current.goals.length - i}>{hallClock(goal.second)} · Tor {day.teams[goal.team].name}</li>)}</ol>
        </section> : null}
        {nextIndex >= 0 && activeIndex < 0 ? <div className={`${TC_CARD} space-y-3 p-4`}><p className="text-[18px] font-bold">Nächstes Spiel: {day.teams[day.games[nextIndex].home].name} – {day.teams[day.games[nextIndex].away].name}</p><button type="button" className={`${button} sz-club-tab-active w-full`} disabled={busy || dirty || configDirty || readOnly || !ready} onClick={() => void mutateGame('start')}>Spiel starten</button>{(!ready || dirty || configDirty) ? <p className="text-[15px] text-amber-200">Bitte zuerst Teams vollständig einteilen und speichern.</p> : null}</div> : null}
        {nextIndex < 0 && !current ? <p role="status" className="text-[18px] font-bold text-emerald-300">Hallenspieltag abgeschlossen ✓</p> : null}
        <p className="text-[15px] text-white/60">Geplante Zeiten. Bei Verzögerungen startest du jedes Spiel selbst.</p>
        <div className="space-y-2">{day.games.map((g, i) => <div key={i} className={`${TC_CARD} flex items-center justify-between gap-2 p-3 text-[16px]`}><span className="text-white/60">{gameTime(i)}</span><span className="flex-1 font-bold">{day.teams[g.home].name} – {day.teams[g.away].name}</span><span>{g.status === 'finished' || g.status === 'running' || g.status === 'paused' ? `${hallScore(g, g.home)}:${hallScore(g, g.away)}` : 'Offen'}</span></div>)}</div>
      </> : null}
      {tab === 'table' ? <div className="overflow-x-auto"><table className="w-full text-left text-[16px]"><caption className="mb-3 text-left font-bold">Interne Trainingstabelle · beendete Spiele</caption><thead><tr><th className="py-2">Team</th><th>Sp.</th><th>Tore</th><th>Pkt.</th></tr></thead><tbody>{hallStandings(day).map(row => <tr key={row.id} className="border-t border-white/10"><td className="py-3 font-bold" style={{ color: HALL_COLORS[row.id] }}>{row.name}</td><td>{row.played}</td><td>{row.goals}:{row.against}</td><td className="font-bold">{row.points}</td></tr>)}</tbody></table></div> : null}
    </div>}
  </Modal>;
}
