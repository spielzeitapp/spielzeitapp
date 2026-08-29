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

function withoutVideoUrls(value: string | null | undefined): string {
  return clean(value)
    .split('\n')
    .map((line) => line.replace(/(?:video\s*:\s*)?https?:\/\/\S+/gi, '').trim())
    .filter(Boolean)
    .join('\n');
}

function extractVideoUrls(...values: Array<string | null | undefined>): string[] {
  const urls = values.flatMap((value) => clean(value).match(/https?:\/\/[^\s<>'"]+/gi) ?? []);
  return [...new Set(urls.map((url) => url.replace(/[),.;]+$/, '')))].filter((url) =>
    /youtube|youtu\.be|vimeo|\.mp4|video/i.test(url),
  );
}

function detailContent(value: string): string {
  const normalized = value.replace(/\s+-\s+/g, '\n- ').trim();
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const listItems = lines
    .filter((line) => /^[-•]\s*/.test(line))
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
  if (listItems.length >= 2 && listItems.length === lines.length) {
    return `<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(value)}</p>`;
}

function detailCard(title: string, value: string | null | undefined, className = ''): string {
  const text = clean(value);
  if (!text) return '';
  return `<section class="detail-card ${className}"><h2>${escapeHtml(title)}</h2>${detailContent(text)}</section>`;
}

function videoCard(urls: string[]): string {
  if (urls.length === 0) return '';
  return `<section class="detail-card videos"><h2>Videos</h2><div class="video-links">${urls
    .map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Video ${index + 1} ansehen</a>`)
    .join('')}</div><small>Links sind im digitalen PDF anklickbar.</small></section>`;
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
    players,
  ].filter(Boolean);
  const season = clean(input.seasonName);
  const footer = [clean(input.teamName), season ? (/^saison\b/i.test(season) ? season : `Saison ${season}`) : '']
    .filter(Boolean)
    .join(' · ');
  const videoUrls = extractVideoUrls(exercise.variations, exercise.source_reference);

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
    .page { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 12mm 12mm 10mm; display: flex; flex-direction: column; background: #fff; }
    .brand { margin: 0 0 3mm; color: #dc2626; font-size: 9pt; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 27pt; line-height: 1.06; letter-spacing: -.025em; }
    .chips { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 4mm; }
    .chip { border: 1px solid #dbe3ee; border-radius: 999px; padding: 1.8mm 3mm; color: #334155; background: #fff; font-size: 8.5pt; font-weight: 700; }
    .chip:first-child { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    .sketch { height: 93mm; margin-top: 6mm; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #dbe3ee; border-radius: 4mm; background: #f8fafc; }
    .sketch img { width: 100%; height: 100%; display: block; object-fit: contain; }
    .no-sketch { color: #94a3b8; font-size: 10pt; font-weight: 700; }
    .content { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, .9fr); gap: 4mm; margin-top: 5mm; }
    .column { display: flex; flex-direction: column; gap: 3mm; min-width: 0; }
    .detail-card { break-inside: avoid; border-top: 1px solid #cbd5e1; padding: 3mm 1mm 1mm; }
    .column.secondary .detail-card { border: 1px solid #e2e8f0; border-radius: 3mm; padding: 3mm; background: #f8fafc; }
    .detail-card h2 { margin: 0 0 1.5mm; color: #0f172a; font-size: 11pt; line-height: 1.1; }
    .detail-card p, .detail-card li { color: #334155; font-size: 9.2pt; line-height: 1.38; }
    .detail-card p { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
    .detail-card ul { margin: 0; padding-left: 4.5mm; }
    .detail-card li + li { margin-top: 1mm; }
    .focus { border-color: #fecaca !important; background: #fef2f2 !important; }
    .focus p { color: #991b1b; font-weight: 700; }
    .video-links { display: flex; flex-wrap: wrap; gap: 2mm; }
    .video-links a { border-radius: 999px; padding: 1.6mm 2.6mm; color: #991b1b; background: #fff; font-size: 8.5pt; font-weight: 700; text-decoration: none; }
    .videos small { display: block; margin-top: 2mm; color: #64748b; font-size: 7.5pt; }
    footer { display: flex; justify-content: space-between; gap: 8mm; margin-top: auto; border-top: 1px solid #cbd5e1; padding-top: 3mm; color: #64748b; font-size: 8pt; }
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
        ${detailCard('Variationen', withoutVideoUrls(exercise.variations))}
      </div>
      <div class="column secondary">
        ${detailCard('Schwerpunkt', focus, 'focus')}
        ${detailCard('Material', exercise.materials)}
        ${detailCard('Coachingpunkte', exercise.coaching_points)}
        ${videoCard(videoUrls)}
      </div>
    </div>
    <footer><span>${escapeHtml(footer || 'SpielzeitApp')}</span><strong>Einzelübung</strong></footer>
  </main>
</body>
</html>`;
}
