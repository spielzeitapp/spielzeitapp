import type { TrainingExerciseRow } from './trainingExercises';
import { formatPlayerCountRange } from './trainingExercises';
import { EXERCISE_FOCUS_LABELS } from './trainingPhases';

type TrainingExerciseHandoutInput = {
  exercise: TrainingExerciseRow;
  sketchUrl?: string | null;
  teamName?: string;
  seasonName?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clean(value: string | null | undefined): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function detailCard(title: string, value: string | null | undefined, className = ''): string {
  const text = clean(value);
  if (!text) return '';
  return `<section class="detail-card ${className}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`;
}

export function createTrainingExerciseHandoutHtml(input: TrainingExerciseHandoutInput): string {
  const { exercise } = input;
  const players = formatPlayerCountRange(exercise.player_count_min, exercise.player_count_max);
  const phases = exercise.suitable_phases.join(' · ');
  const focus = EXERCISE_FOCUS_LABELS[exercise.focus] ?? exercise.focus;
  const meta = [
    phases,
    exercise.age_group,
    `${exercise.duration_minutes} Min.`,
    players ? `${players} Spieler` : '',
  ].filter(Boolean);
  const footer = [input.teamName, input.seasonName ? `Saison ${input.seasonName}` : ''].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(exercise.title)} – Einzelübung</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    body { background: #e5e7eb; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; padding: 12px; background: #0f172a; }
    .toolbar button { min-height: 42px; border: 0; border-radius: 999px; padding: 10px 22px; color: #fff; background: #b91c1c; font-size: 14px; font-weight: 700; cursor: pointer; }
    .page { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 12mm 12mm 10mm; background: #fff; }
    .brand { margin: 0 0 3mm; color: #dc2626; font-size: 9pt; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 27pt; line-height: 1.06; letter-spacing: -.025em; }
    .chips { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 4mm; }
    .chip { border: 1px solid #dbe3ee; border-radius: 999px; padding: 1.8mm 3mm; color: #334155; background: #fff; font-size: 8pt; font-weight: 700; }
    .chip:first-child { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    .sketch { height: 93mm; margin-top: 6mm; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #dbe3ee; border-radius: 4mm; background: #f8fafc; }
    .sketch img { width: 100%; height: 100%; display: block; object-fit: contain; }
    .no-sketch { color: #94a3b8; font-size: 10pt; font-weight: 700; }
    .content { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, .9fr); gap: 4mm; margin-top: 5mm; }
    .column { display: flex; flex-direction: column; gap: 3mm; min-width: 0; }
    .detail-card { break-inside: avoid; border-top: 1px solid #cbd5e1; padding: 3mm 1mm 1mm; }
    .column.secondary .detail-card { border: 1px solid #e2e8f0; border-radius: 3mm; padding: 3mm; background: #f8fafc; }
    .detail-card h2 { margin: 0 0 1.5mm; color: #0f172a; font-size: 10.5pt; line-height: 1.1; }
    .detail-card p { margin: 0; white-space: pre-line; overflow-wrap: anywhere; color: #334155; font-size: 8.2pt; line-height: 1.34; }
    .focus { border-color: #fecaca !important; background: #fef2f2 !important; }
    .focus p { color: #991b1b; font-weight: 700; }
    footer { display: flex; justify-content: space-between; gap: 8mm; margin-top: 5mm; border-top: 1px solid #cbd5e1; padding-top: 3mm; color: #64748b; font-size: 7.5pt; }
    footer strong { color: #0f172a; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Drucken / als PDF speichern</button></div>
  <main class="page">
    <header>
      <p class="brand">Spielzeit Manager · Einzelübung</p>
      <h1>${escapeHtml(exercise.title)}</h1>
      <div class="chips">${meta.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('')}</div>
    </header>
    <div class="sketch">
      ${input.sketchUrl
        ? `<img src="${escapeHtml(input.sketchUrl)}" alt="Skizze zu ${escapeHtml(exercise.title)}" />`
        : '<div class="no-sketch">Keine Skizze vorhanden</div>'}
    </div>
    <div class="content">
      <div class="column">
        ${detailCard('Kurzbeschreibung', exercise.organization ? null : exercise.description)}
        ${detailCard('Organisation & Aufbau', exercise.organization)}
        ${detailCard('Ablauf', exercise.organization ? exercise.description : null)}
        ${detailCard('Variationen', exercise.variations)}
      </div>
      <div class="column secondary">
        ${detailCard('Schwerpunkt', focus, 'focus')}
        ${detailCard('Material', exercise.materials)}
        ${detailCard('Coachingpunkte', exercise.coaching_points)}
      </div>
    </div>
    <footer><span>${escapeHtml(footer || 'SpielzeitApp')}</span><strong>Einzelübung</strong></footer>
  </main>
</body>
</html>`;
}
