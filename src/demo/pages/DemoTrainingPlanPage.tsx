import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DEMO_TRAINING_PLAN as plan } from '../demoTrainingPlan';

const phases = { AW: 'Aufwärmen', HT1: 'Hauptteil 1', HT2: 'Hauptteil 2', AK: 'Abschlussteil' };

export function DemoTrainingPlanPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const handout = params.get('ansicht') === 'handout';
  return (
    <div className="space-y-5 pb-6">
      <Link to="/demo/home" className="inline-flex min-h-11 items-center text-sm font-semibold text-white/70">← Zur App-Demo</Link>
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-red-300">Trainingsplanung · Beispieltraining</p>
        <h1 className="text-2xl font-extrabold text-white">{plan.title}</h1>
        <p className="text-sm text-white/65">{plan.duration} Minuten · {plan.exercises.length} Übungen · Vom Aufwärmen bis zum Abschlussteil</p>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Trainingsansicht wählen">
        <button type="button" aria-pressed={!handout} onClick={() => setParams({})} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${!handout ? 'border-red-400/50 bg-red-950 text-white' : 'border-white/15 text-white/65'}`}>Übungen entdecken</button>
        <button type="button" aria-pressed={handout} onClick={() => setParams({ ansicht: 'handout' })} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${handout ? 'border-red-400/50 bg-red-950 text-white' : 'border-white/15 text-white/65'}`}>Handout ansehen</button>
      </div>
      {handout ? (
        <section className="rounded-2xl bg-white p-4 text-slate-900 sm:p-6" aria-label="Trainingshandout">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b-2 border-red-700 pb-4">
            <div><h2 className="text-xl font-extrabold">{plan.title}</h2><p className="mt-1 text-sm text-slate-500">Trainingsplan · {plan.duration} Minuten · 4 Übungen</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {plan.exercises.map(exercise => (
              <article key={exercise.phase} className="min-w-0 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase text-red-700">{phases[exercise.phase]} · {exercise.duration} Min.</p>
                <h3 className="mt-2 font-extrabold">{exercise.title}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{exercise.content}</p>
                <h4 className="mt-4 text-xs font-bold uppercase text-slate-500">Material</h4><p className="mt-1 text-sm">{exercise.materials}</p>
                <h4 className="mt-4 text-xs font-bold uppercase text-slate-500">Coachingpunkte</h4><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{exercise.coaching}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {plan.exercises.map(exercise => (
            <details key={exercise.phase} className="overflow-hidden rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-950/30 to-neutral-950">
              <summary className="min-h-16 cursor-pointer p-5 marker:text-red-400">
                <span className="text-xs font-bold uppercase text-red-300">{phases[exercise.phase]} · {exercise.duration} Min.</span>
                <strong className="mt-2 block text-base text-white">{exercise.title}</strong>
              </summary>
              <div className="space-y-4 border-t border-white/10 p-5 text-sm leading-relaxed text-white/75">
                <div><h3 className="mb-2 font-bold text-white">Aufbau &amp; Ablauf</h3><p className="whitespace-pre-line">{exercise.content}</p></div>
                <div><h3 className="mb-2 font-bold text-white">Material</h3><p>{exercise.materials}</p></div>
                <div><h3 className="mb-2 font-bold text-white">Coachingpunkte</h3><p className="whitespace-pre-line">{exercise.coaching}</p></div>
              </div>
            </details>
          ))}
          <p className="text-xs text-white/50">Übung öffnen und den Trainingsablauf kennenlernen.</p>
        </div>
      )}
    </div>
  );
}
