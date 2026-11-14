export type RunExercise = { id: string; title: string; seconds: number; originalSeconds: number; active: number; done: boolean };
export type TrainingRun = { version: 1; startedAt: number; since: number; finishedAt: number | null; index: number; phase: 'explain' | 'active' | 'break' | 'match' | 'finished'; explanation: number; breaks: number; matchBaseline: number; exercises: RunExercise[] };
export function createTrainingRun(items: { id: string; title: string; seconds: number }[], now = Date.now()): TrainingRun {
 if (!items.length || items.length > 80 || items.some(i => !Number.isFinite(i.seconds) || i.seconds <= 0)) throw new Error('Bitte zuerst Übungen mit gültiger Dauer planen.');
 return { version: 1, startedAt: now, since: now, finishedAt: null, index: 0, phase: 'explain', explanation: 0, breaks: 0, matchBaseline: 0, exercises: items.map(i => ({ ...i, originalSeconds: i.seconds, active: 0, done: false })) };
}
export function checkpointRun(run: TrainingRun, now = Date.now()): TrainingRun {
 const next = structuredClone(run), dt = Math.max(0, (now - run.since) / 1000);
 if (run.phase === 'active' && next.exercises[next.index]) next.exercises[next.index].active += dt;
 if (run.phase === 'explain') next.explanation += dt;
 if (run.phase === 'break') next.breaks += dt;
 next.since = now;
 return next;
}
export function changeRunPhase(run: TrainingRun, phase: TrainingRun['phase'], now = Date.now()): TrainingRun {
 if (run.finishedAt || run.phase === 'match') throw new Error('Bitte zuerst das Trainingsmatch schließen.');
 const next = checkpointRun(run, now); next.phase = phase;
 if (phase === 'finished') next.finishedAt = now;
 return next;
}
export function nextRunExercise(run: TrainingRun, now = Date.now()): TrainingRun {
 const next = changeRunPhase(run, 'explain', now);
 next.exercises[next.index].done = true;
 next.index++;
 if (next.index >= next.exercises.length) { next.phase = 'finished'; next.finishedAt = now; }
 return next;
}
export function importRunMatch(run: TrainingRun, matchSeconds: number, now = Date.now()): TrainingRun {
 if (run.phase !== 'match') return run;
 const next = structuredClone(run), wall = Math.max(0, (now - run.since) / 1000);
 const active = Math.min(wall, Math.max(0, matchSeconds - run.matchBaseline));
 next.exercises[next.index].active += active;
 next.breaks += wall - active;
 next.phase = 'explain'; next.since = now;
 return next;
}
export function runTiming(run: TrainingRun, deadline: number, now = Date.now()) {
 const current = checkpointRun(run, now);
 const remaining = current.exercises.reduce((sum, e, i) => sum + (i < current.index ? 0 : Math.max(0, e.seconds - e.active)), 0);
 const end = run.finishedAt ?? now + remaining * 1000;
 return { current, remaining, end, delay: Math.max(0, Math.ceil((end - deadline) / 1000)), active: current.exercises.reduce((sum, e) => sum + e.active, 0), total: Math.max(0, ((run.finishedAt ?? now) - run.startedAt) / 1000) };
}
export function shortenRun(run: TrainingRun, deadline: number, now = Date.now()): TrainingRun {
 const next = checkpointRun(run, now);
 if (run.finishedAt || run.phase === 'match') throw new Error('Dieser Ablauf kann gerade nicht gekürzt werden.');
 const future = next.exercises.slice(next.index + 1);
 const currentLeft = Math.max(0, next.exercises[next.index].seconds - next.exercises[next.index].active);
 const budget = Math.floor((deadline - now) / 1000 - currentLeft);
 if (!future.length || budget < future.length * 60) throw new Error('Die offenen Übungen passen selbst mit je 1 Minute nicht mehr hinein. Bitte Ablauf oder Endzeit anpassen.');
 const total = future.reduce((sum, e) => sum + e.seconds, 0);
 const scale = Math.min(1, Math.max(0, budget - Math.min(15, budget - future.length * 60) - future.length * 60) / Math.max(1, total - future.length * 60));
 future.forEach(e => { e.seconds = Math.min(e.seconds, 60 + Math.floor((e.seconds - 60) * scale)); });
 return next;
}
