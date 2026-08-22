import type { TrainingExerciseRow } from './trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from './trainingSessions';
import { TRAINING_PHASE_LABELS, TRAINING_PHASES } from './trainingPhases';
import { VIENNA_TZ } from './viennaTime';

type HandoutInput = {
  session: TrainingSessionRow;
  items: TrainingSessionExerciseRow[];
  exerciseMap: Record<string, TrainingExerciseRow>;
  sketchUrls: Record<string, string | null>;
  teamName?: string;
  trainerName?: string;
  dateIso?: string | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function compact(value: string | null | undefined, max: number): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function renderExercise(
  item: TrainingSessionExerciseRow,
  exercise: TrainingExerciseRow | undefined,
  sketchUrl: string | null | undefined,
): string {
  const description = compact(exercise?.description ?? exercise?.organization, 310);
  const materials = compact(exercise?.materials, 145);
  const coaching = compact(exercise?.coaching_points, 235);
  const notes = compact(item.coach_notes, 120);
  return `
    <article class="exercise">
      <header class="exercise-head">
        <div>
          <div class="phase">${escapeHtml(TRAINING_PHASE_LABELS[item.phase])}</div>
          <h2>${escapeHtml(exercise?.title || 'Übung')}</h2>
        </div>
        <div class="duration">${item.duration_minutes} Min.</div>
      </header>
      <div class="exercise-body">
        <div class="sketch">
          ${
            sketchUrl
              ? `<img src="${escapeHtml(sketchUrl)}" alt="Skizze zu ${escapeHtml(exercise?.title || 'Übung')}" />`
              : '<div class="no-sketch">Keine Skizze</div>'
          }
        </div>
        <div class="details">
          ${description ? `<section><h3>Aufbau &amp; Ablauf</h3><p>${escapeHtml(description)}</p></section>` : ''}
          ${materials ? `<section><h3>Material</h3><p>${escapeHtml(materials)}</p></section>` : ''}
          ${coaching ? `<section><h3>Coachingpunkte</h3><p>${escapeHtml(coaching)}</p></section>` : ''}
          ${notes ? `<section><h3>Trainernotiz</h3><p>${escapeHtml(notes)}</p></section>` : ''}
        </div>
      </div>
    </article>`;
}

export function createTrainingSessionHandoutHtml(input: HandoutInput): string {
  const ordered = [...input.items].sort((a, b) => {
    const phase = TRAINING_PHASES.indexOf(a.phase) - TRAINING_PHASES.indexOf(b.phase);
    return phase || a.sort_order - b.sort_order;
  });
  const pages: TrainingSessionExerciseRow[][] = [];
  for (let index = 0; index < ordered.length; index += 4) pages.push(ordered.slice(index, index + 4));
  const totalMinutes = ordered.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const date = formatDate(input.dateIso);

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.session.title)} – A4-Handout</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    body { background: #e5e7eb; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; gap: 12px; padding: 12px; background: #111827; }
    .toolbar button { border: 0; border-radius: 999px; padding: 10px 20px; color: white; background: #b91c1c; font-size: 14px; font-weight: 700; cursor: pointer; }
    .page { width: 297mm; min-height: 210mm; margin: 12px auto; padding: 7mm 8mm 8mm; background: white; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .page-head { height: 22mm; display: grid; grid-template-columns: 1fr auto; gap: 8mm; align-items: start; border-bottom: 1.5px solid #b91c1c; padding-bottom: 3mm; }
    .page-head h1 { margin: 0 0 1.5mm; font-size: 18pt; line-height: 1.05; }
    .meta, .objective { margin: 0; color: #4b5563; font-size: 8.5pt; line-height: 1.25; }
    .objective { margin-top: 1.2mm; }
    .total { min-width: 32mm; border-radius: 3mm; padding: 3mm 4mm; background: #fef2f2; color: #991b1b; text-align: center; }
    .total strong { display: block; font-size: 17pt; }
    .total span { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .grid { height: 168mm; padding-top: 4mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4mm; }
    .exercise { min-height: 0; overflow: hidden; border: 1px solid #d1d5db; border-radius: 3mm; padding: 3mm; }
    .exercise-head { min-height: 11mm; display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; border-bottom: 1px solid #e5e7eb; padding-bottom: 2mm; }
    .phase { color: #b91c1c; font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: .09em; }
    h2 { margin: .7mm 0 0; font-size: 12.5pt; line-height: 1.05; }
    .duration { flex: 0 0 auto; border-radius: 999px; padding: 1.4mm 2.6mm; background: #f3f4f6; font-size: 8pt; font-weight: 700; }
    .exercise-body { height: calc(100% - 13mm); min-height: 0; display: grid; grid-template-columns: 44% 1fr; gap: 3mm; padding-top: 2.5mm; }
    .sketch { min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 2mm; background: #f9fafb; }
    .sketch img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .no-sketch { color: #9ca3af; font-size: 8pt; }
    .details { min-height: 0; overflow: hidden; }
    section { margin: 0 0 1.6mm; }
    h3 { margin: 0 0 .5mm; color: #4b5563; font-size: 7pt; line-height: 1.1; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 0; font-size: 7.3pt; line-height: 1.18; overflow-wrap: anywhere; }
    @page { size: A4 landscape; margin: 0; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Drucken / als PDF speichern</button></div>
  ${pages
    .map(
      (pageItems) => `<main class="page">
        <header class="page-head">
          <div>
            <h1>${escapeHtml(input.session.title)}</h1>
            <p class="meta">${escapeHtml([input.teamName, date, input.trainerName ? `Trainer: ${input.trainerName}` : ''].filter(Boolean).join(' · '))}</p>
            ${input.session.objective ? `<p class="objective"><strong>Trainingsziel:</strong> ${escapeHtml(compact(input.session.objective, 220))}</p>` : ''}
          </div>
          <div class="total"><strong>${totalMinutes}</strong><span>Minuten</span></div>
        </header>
        <section class="grid">
          ${pageItems
            .map((item) =>
              renderExercise(item, input.exerciseMap[item.exercise_id], input.sketchUrls[item.exercise_id]),
            )
            .join('')}
        </section>
      </main>`,
    )
    .join('')}
</body>
</html>`;
}
