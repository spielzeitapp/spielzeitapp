import React, { useEffect, useRef, useState } from 'react';
import { Clock3, Play, Pause, Volume2, VolumeX, BarChart3 } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { useDemoMode } from '../../demo/DemoContext';
import { listSessionExercises, type TrainingSessionRow } from '../../lib/trainingSessions';
import { TRAINING_PHASES } from '../../lib/trainingPhases';
import { createTrainingRun, changeRunPhase, nextRunExercise, runTiming, shortenRun, importRunMatch, type TrainingRun } from '../../lib/trainingRun';
import { loadTrainingRun, saveTrainingRun } from '../../lib/trainingRunStore';
import { loadHallDay } from '../../lib/hallTrainingStore';
import { hallElapsed, hallGameSeconds, hallClock } from '../../lib/hallTraining';
import './trainingRun.css';
const action = 'sz-club-event-action tr-action';
export function TrainingRunModal({ open, onClose, session, eventId, endsAt, canStart, readOnly, onOpenMatch }: { open: boolean; onClose: () => void; session: TrainingSessionRow | null; eventId: string; endsAt?: string | null; canStart: boolean; readOnly: boolean; onOpenMatch: (minutes: number) => void }) {
 const demo = useDemoMode();
 const [run, setRun] = useState<TrainingRun | null>(null), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [now, setNow] = useState(Date.now()), [bilanz, setBilanz] = useState(false), [sound, setSound] = useState(true), [soundError, setSoundError] = useState(false), [notice, setNotice] = useState<string | null>(null);
 const [items, setItems] = useState<{ id: string; title: string; seconds: number }[]>([]);
 const saving = useRef(false), sounded = useRef<string | null>(null), audio = useRef<AudioContext | null>(null), generation = useRef(0);
 const matchSeconds = async () => { const row = await loadHallDay(eventId); return row ? row.day.games.reduce((sum, g) => sum + hallElapsed(g, hallGameSeconds(row.day, g)), 0) : 0; };
 const save = async (next: TrainingRun) => {
  if (!session || readOnly || saving.current) return false;
  const token = generation.current; saving.current = true; setBusy(true); setError(null);
  try {
   const rev = demo ? revision + 1 : await saveTrainingRun(session.id, next, revision);
   if (demo) sessionStorage.setItem(`training-run:${session.id}`, JSON.stringify({ run: next, revision: rev }));
   if (token === generation.current) { setRun(next); setRevision(rev); setNow(Date.now()); }
   return true;
  } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); return false; }
  finally { saving.current = false; if (token === generation.current) setBusy(false); }
 };
 useEffect(() => { if (!open) return; const token = ++generation.current; let active = true; setLoading(true); setError(null); setRun(null); setItems([]); setBilanz(false);
  if (!session) { setLoading(false); return; }
  (async () => {
   const [stored, exercises] = await Promise.all([demo ? Promise.resolve(JSON.parse(sessionStorage.getItem(`training-run:${session.id}`) ?? '{"run":null,"revision":0}')) : loadTrainingRun(session.id), listSessionExercises(session.id)]);
   if (exercises.error && !stored.run) throw new Error('Übungen konnten nicht geladen werden.');
   let restored = stored.run as TrainingRun | null, rev = Number(stored.revision);
   if (restored?.phase === 'match' && !readOnly && !demo) {
    restored = importRunMatch(restored, await matchSeconds());
    rev = await saveTrainingRun(session.id, restored, rev);
   }
   if (!active || token !== generation.current) return;
   setRun(restored); setRevision(rev); setNow(Date.now());
   setItems([...exercises.data].sort((a,b) => TRAINING_PHASES.indexOf(a.phase) - TRAINING_PHASES.indexOf(b.phase) || a.sort_order-b.sort_order).map(e => ({ id:e.id, title:e.exercise?.title ?? 'Übung', seconds:e.duration_minutes*60 })));
  })().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [open, session?.id, eventId, demo, readOnly]);
 useEffect(() => { if (!open) return; const id = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(id); }, [open]);
 useEffect(() => () => { void audio.current?.close(); }, []);
 const deadline = endsAt && Number.isFinite(Date.parse(endsAt)) ? Date.parse(endsAt) : (run?.startedAt ?? now) + (session?.planned_duration_minutes ?? 75)*60000;
 const timing = run ? runTiming(run, deadline, now) : null;
 const exercise = timing?.current.exercises[run?.index ?? 0];
 const remaining = exercise ? Math.max(0, exercise.seconds - exercise.active) : 0;
 const soundReady = async () => {
  try { const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!Ctor) throw new Error(); audio.current ??= new Ctor(); await audio.current.resume(); if (audio.current.state !== 'running') throw new Error(); setSoundError(false); return audio.current; } catch { setSoundError(true); return null; }
 };
 const beep = (context: AudioContext) => { const osc = context.createOscillator(), gain = context.createGain(); osc.frequency.value = 740; gain.gain.setValueAtTime(.18, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime+1); osc.connect(gain); gain.connect(context.destination); osc.start(); osc.stop(context.currentTime+1); };
 useEffect(() => {
  const key = `${run?.startedAt}:${run?.index}`;
  if (!open || !sound || run?.phase !== 'active' || remaining > 0 || sounded.current === key || !audio.current || audio.current.state !== 'running') return;
  beep(audio.current); sounded.current = key;
 }, [open, sound, run?.phase, run?.index, run?.startedAt, remaining]);
 const phase = async (value: 'active' | 'explain' | 'break') => { if (!run) return; if (value === 'active' && sound) await soundReady(); await save(changeRunPhase(run,value)); };
 const goMatch = async () => {
  const minutes = Math.max(15, Math.ceil(remaining / 60));
  if (remaining < 900 && !window.confirm('Die interne Matchplanung benötigt mindestens 15 Minuten. Trotzdem öffnen?')) return;
  if (!run || demo) { onOpenMatch(minutes); return; }
  try { const baseline = await matchSeconds(); const next = changeRunPhase(run,'break'); next.phase='match'; next.matchBaseline=baseline; if (await save(next)) onOpenMatch(minutes); } catch { setError('Matchzeiten konnten nicht geladen werden. Bitte erneut versuchen.'); }
 };
 const finish = async () => { if (run && window.confirm('Übungsablauf abschließen? Nicht absolvierte Übungen bleiben als offen dokumentiert.')) { if (await save(changeRunPhase(run,'finished'))) setBilanz(true); } };
 const reload = () => { onClose(); };
 const clock = (stamp: number) => new Date(stamp).toLocaleTimeString('de-AT',{timeZone:'Europe/Vienna',hour:'2-digit',minute:'2-digit'});
 return <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Trainingszentrale · Ablauf" className="training-run-modal">
  {loading ? <p role="status">Ablauf wird geladen…</p> : <div className="tr-stack">
   {error ? <div role="alert" className="tr-warning"><p>{error}</p><button type="button" className={action} onClick={reload}>Schließen & erneut öffnen</button></div> : null}
   {notice ? <p role="status">{notice}</p> : null}
   {!session ? <p>Bitte zuerst eine Trainingseinheit mit Übungen planen. Interne Trainingsmatches kannst du direkt in der Trainingszentrale öffnen.</p> : !run ? <><h3>{session.title}</h3><p>{items.length} Übungen · {Math.round(items.reduce((sum,i)=>sum+i.seconds,0)/60)} Min. aktive Übungszeit geplant</p><p>Teilnehmer zuerst prüfen. Danach führt dich der Ablauf durch Erklärung, aktive Übung und Wechselpause.</p><button type="button" className={`${action} sz-club-tab-active`} disabled={readOnly || !canStart || busy || !!error || !items.length} onClick={() => void save(createTrainingRun(items))}><Play size={20} aria-hidden />Training starten</button>{!items.length ? <p>Im Trainingsplan sind noch keine Übungen eingetragen.</p> : null}</> : timing ? <>
    <div className="tr-tabs"><button type="button" className={`${action} ${!bilanz ? 'sz-club-tab-active' : ''}`} onClick={() => setBilanz(false)}>Ablauf</button><button type="button" className={`${action} ${bilanz ? 'sz-club-tab-active' : ''}`} onClick={() => setBilanz(true)}>Trainingsbilanz</button></div>
    <div className="tr-meta"><span>{session.title}</span><button type="button" aria-label={sound ? 'Sirene ausschalten' : 'Sirene einschalten'} aria-pressed={sound} className="tr-siren" onClick={async () => { setSound(!sound); if (!sound) await soundReady(); }}>{sound ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}</button></div>
    {soundError ? <p role="status">Ton nicht verfügbar. Bitte Lautstärke prüfen und Ton testen.</p> : null}<button type="button" className="tr-sound-test" onClick={async () => { const context=await soundReady(); if(context)beep(context); }}>Ton testen</button>
    {!bilanz && !run.finishedAt ? <section className="tr-current"><span className="tr-phase">{run.phase === 'active' ? 'Aktive Übung' : run.phase === 'break' ? 'Wechsel & Trinkpause' : run.phase === 'match' ? 'Internes Trainingsmatch' : 'Erklärung & Aufbau'} · {run.index+1} / {run.exercises.length}</span><h3>{exercise?.title}</h3><strong className="tr-countdown">{hallClock(remaining)}</strong><p>{remaining ? 'Aktive Übungszeit verbleibend' : 'Geplante Übungszeit erreicht · tatsächliche Zeit läuft bis zur Unterbrechung weiter'}</p>
     <fieldset disabled={readOnly || busy || !!error || run.phase === 'match'} className="tr-controls"><button type="button" className={`${action} sz-club-tab-active`} onClick={() => void phase(run.phase === 'active' ? 'explain' : 'active')}>{run.phase === 'active' ? <Pause size={19} aria-hidden /> : <Play size={19} aria-hidden />}{run.phase === 'active' ? 'Unterbrechen / erklären' : 'Übung starten / fortsetzen'}</button><div className="tr-split"><button type="button" className={action} onClick={() => void phase('break')}>Trinkpause</button><button type="button" className={action} onClick={() => { if(window.confirm('Diese Übung beenden und weitergehen?'))void save(nextRunExercise(run)); }}>{run.index === run.exercises.length-1 ? 'Letzte Übung beenden' : 'Nächste Übung'}</button></div></fieldset>
     {run.phase === 'match' ? <button type="button" className={action} onClick={() => onOpenMatch(Math.max(15, Math.ceil(remaining / 60)))}>Trainingsmatch öffnen</button> : <button type="button" className={action} disabled={readOnly || busy || !!error} onClick={() => void goMatch()}>Diese Übung als Trainingsmatch</button>}
    </section> : null}
    <div className="tr-metrics"><div><Clock3 size={18} aria-hidden /><span>Aktive Trainingszeit</span><strong>{hallClock(timing.active)}</strong></div><div><BarChart3 size={18} aria-hidden /><span>Gesamtzeit</span><strong>{hallClock(timing.total)}</strong></div></div>
    {bilanz || run.finishedAt ? <section className="tr-summary"><h3>{run.finishedAt ? 'Abschlussübersicht' : 'Zwischenstand'}</h3><p>Erklärung & Aufbau <strong>{hallClock(timing.current.explanation)} Min.</strong></p><p>Wechsel & Trinkpause <strong>{hallClock(timing.current.breaks)} Min.</strong></p><p>Übungen abgeschlossen <strong>{run.exercises.filter(e=>e.done).length} / {run.exercises.length}</strong></p><p>Aktive Zeit ist Gruppenzeit. Individuelle Wartezeiten innerhalb einer Übung werden nicht einzeln erfasst.</p></section> : null}
    {!run.finishedAt ? <section className={timing.delay > 30 ? 'tr-warning' : 'tr-summary'}><strong>{timing.delay > 30 ? `${Math.ceil(timing.delay/60)} Min. über der Endzeit` : 'Zeitprognose'}</strong><p>Geplant {clock(deadline)} · voraussichtlich {clock(timing.end)} Uhr</p><p>Prognose ohne weitere Erklärungen oder Pausen. Diese Zeiten kommen zusätzlich dazu.</p>{timing.delay > 30 ? <button type="button" className={action} disabled={readOnly || busy || !!error || run.phase === 'match'} onClick={async () => { try { const next=shortenRun(run,deadline);if(window.confirm('Nur die noch nicht begonnenen Übungen kürzen? Die aktuelle Übung bleibt unverändert.'))await save(next); } catch(e){setNotice(e instanceof Error?e.message:'Anpassung fehlgeschlagen.');} }}>Offene Übungen kürzen</button> : null}</section> : null}
    <details className="tr-summary" open={bilanz}><summary>Dein Trainingsablauf</summary>{run.exercises.map((e,i)=><div key={e.id} className="tr-exercise"><span>{e.done ? '✓' : i+1}</span><span>{e.title}<small>{e.done ? 'Absolviert' : i===run.index && !run.finishedAt ? 'Aktuell' : 'Offen'}</small></span><strong>{hallClock(timing.current.exercises[i].active)}<small>von {hallClock(e.seconds)}</small></strong></div>)}</details>
    {!run.finishedAt ? <button type="button" className={action} disabled={readOnly || busy || !!error || run.phase === 'match'} onClick={() => void finish()}>Übungsablauf abschließen</button> : null}
    <p className="tr-footnote">Jeder Phasenwechsel wird gespeichert. Beim Schließen läuft die gewählte Phase weiter. Sirene nur bei geöffneter App und eingeschaltetem Bildschirm.</p>
   </> : null}
  </div>}
 </Modal>;
}
