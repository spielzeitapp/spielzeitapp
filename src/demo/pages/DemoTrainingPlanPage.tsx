import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DEMO_TRAINING_PLAN as plan } from '../demoTrainingPlan';

const exerciseImages = { AW: 1, HT1: 2, HT2: 3, AK: 4 };

function ExerciseSketch({ phase, title }: { phase: keyof typeof exerciseImages; title: string }): React.ReactElement {
  return (
    <div className="flex justify-center rounded-xl border border-slate-100 bg-white p-2">
      <div className="relative w-full max-w-[300px] overflow-hidden" style={{ aspectRatio: '752 / 784' }}>
        <img src={`/landingpage-assets/training-videodokumentation-${exerciseImages[phase]}.webp`} alt={`Skizze: ${title}`} className="absolute max-w-none" style={{ left: '-9.575%', top: '-27.551%', width: '255.319%', height: 'auto' }} />
      </div>
    </div>
  );
}

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
                <h3 className="mt-2 mb-3 font-extrabold">{exercise.title}</h3>
                <ExerciseSketch phase={exercise.phase} title={exercise.title} />
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{exercise.content}</p>
                <h4 className="mt-4 text-xs font-bold uppercase text-slate-500">Material</h4><p className="mt-1 text-sm">{exercise.materials}</p>
                <h4 className="mt-4 text-xs font-bold uppercase text-slate-500">Coachingpunkte</h4><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{exercise.coaching}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-3 sm:p-5">
          {plan.exercises.map(exercise => (
            <section key={exercise.phase} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">{phases[exercise.phase]} <span className="ml-2 text-sm font-normal text-slate-500">{exercise.duration} Min.</span></h2>
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
                <div className="p-3"><ExerciseSketch phase={exercise.phase} title={exercise.title} /></div>
                <div className="min-w-0 space-y-4 p-4 md:border-l md:border-slate-100">
                  <h3 className="text-lg font-semibold leading-snug">{exercise.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-red-800">{phases[exercise.phase]}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{exercise.duration} Min.</span>
                  </div>
                  <details className="rounded-xl border border-slate-200">
                    <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">Aufbau, Ablauf &amp; Coaching</summary>
                    <div className="space-y-4 border-t border-slate-100 p-3 text-sm leading-relaxed text-slate-600">
                      <div><h4 className="mb-2 font-bold text-slate-900">Aufbau &amp; Ablauf</h4><p className="whitespace-pre-line">{exercise.content}</p></div>
                      <div><h4 className="mb-2 font-bold text-slate-900">Material</h4><p>{exercise.materials}</p></div>
                      <div><h4 className="mb-2 font-bold text-slate-900">Coachingpunkte</h4><p className="whitespace-pre-line">{exercise.coaching}</p></div>
                    </div>
                  </details>
                </div>
              </article>
            </section>
          ))}
          <p className="text-xs text-slate-500">Beispieltraining zur Ansicht · Übungsdetails aufklappen und den Ablauf kennenlernen.</p>
        </div>
      )}
    </div>
  );
}
