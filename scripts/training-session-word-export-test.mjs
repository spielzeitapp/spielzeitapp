import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { createServer } from 'vite';

const outputPath = process.env.TRAINING_WORD_QA_OUTPUT || '';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

try {
  const { buildTrainingSessionWord } = await vite.ssrLoadModule('/src/lib/trainingSessionWordExport.ts');
  const phases = ['AW', 'HT1', 'HT1', 'HT2', 'HT2', 'AK'];
  const items = phases.map((phase, index) => ({
    id: `item-${index + 1}`,
    training_session_id: 'session-1',
    exercise_id: `exercise-${index + 1}`,
    phase,
    sort_order: index,
    duration_minutes: 15,
    coach_notes: index === 0 ? 'Auf saubere Ausführung achten.' : null,
  }));
  const exerciseMap = Object.fromEntries(
    items.map((item, index) => [
      item.exercise_id,
      {
        id: item.exercise_id,
        title: `Übung ${index + 1}`,
        description:
          'Die Spieler lösen die Aufgabe in mehreren Gruppen. Nach jeder Aktion wird sofort die Position gewechselt. Auf ein sauberes Tempo, klare Laufwege und viele Wiederholungen achten.',
        focus: 'technik',
        suitable_phases: [item.phase],
        age_group: 'U12',
        duration_minutes: 15,
        player_count_min: 8,
        player_count_max: 14,
        difficulty: 'medium',
        materials: 'Bälle, Hütchen, Überzieher und zwei Minitore',
        organization: 'Feld passend zur Spielerzahl aufbauen und Gruppen gleichmäßig einteilen.',
        coaching_points:
          'Vororientierung, offene Stellung, mutige Entscheidungen und hohes Tempo. Nach Ballverlust sofort umschalten.',
        variations: 'Kontakte begrenzen oder Feld verkleinern.',
        image_path: 'fixture.png',
        source_type: 'import',
        source_reference: null,
        is_active: true,
      },
    ]),
  );
  const bytes = await buildTrainingSessionWord({
    session: {
      id: 'session-1',
      club_id: 'club-1',
      team_id: 'team-1',
      team_season_id: 'season-1',
      event_id: null,
      title: 'U12 – Technik und Spielformen',
      objective: 'Ballkontrolle und schnelles Umschalten',
      notes: null,
      planned_duration_minutes: 90,
      status: 'ready',
      record_type: 'session',
      source_session_id: null,
      template_id: null,
      focus: 'technik',
      age_group: 'U12',
      actual_duration_minutes: null,
      completed_at: null,
      completed_by: null,
      review_rating: null,
      review_notes: null,
      worked_well: null,
      needs_improvement: null,
      repeat_next_time: false,
      archived_at: null,
      archived_by: null,
    },
    items,
    exerciseMap,
    trainerName: 'Johannes Baumann',
    teamName: 'SPG Rohrbach U12',
    dateIso: '2026-08-20T17:00:00.000Z',
    resolveSketchPng: async () => new Uint8Array(fs.readFileSync('public/logos/spg-rohrbach.png')),
  });
  const archive = unzipSync(bytes);
  const documentXml = strFromU8(archive['word/document.xml']);
  assert.match(documentXml, /NÖFV-ÖFB-D-Diplom/);
  assert.match(documentXml, /Johannes Baumann/);
  assert.match(documentXml, /SPG Rohrbach U12/);
  assert.match(documentXml, /Übung 6/);
  assert.equal((documentXml.match(/w:type="page"/g) ?? []).length, 1, 'six exercises use two pages');
  assert.ok(archive['word/styles.xml']);
  assert.ok(archive['word/_rels/document.xml.rels']);
  if (outputPath) fs.writeFileSync(outputPath, bytes);
  console.log(`training-session-word-export: ok${outputPath ? ` (${outputPath})` : ''}`);
} finally {
  await vite.close();
}
