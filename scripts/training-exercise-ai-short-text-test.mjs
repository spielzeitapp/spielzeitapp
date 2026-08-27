import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, client, edge] = await Promise.all([
  readFile(new URL('../src/manager/ManagerTrainingLibraryPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/trainingExerciseAiShortText.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/shorten-training-exercise/index.ts', import.meta.url), 'utf8'),
]);

assert.match(page, /Prüfen & bei Bedarf KI kürzen/);
assert.match(page, /Prüfen &amp; übernehmen \(ohne KI\)/);
assert.match(page, /createTrainingExerciseAiShortText/);
assert.match(page, /originalTextFitsPdf/);
assert.match(page, /Es wurde keine KI verwendet/);
assert.match(page, /pdfFit={shortTextPdfFit\.content}/);
assert.match(client, /supabase\.functions\.invoke<AiShortTextResponse>/);
assert.match(client, /shorten-training-exercise/);
assert.match(edge, /OPENAI_API_KEY/);
assert.match(edge, /can_manage_club_venues/);
assert.match(edge, /https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(edge, /type: 'json_schema'/);
assert.match(edge, /store: false/);
assert.match(edge, /setup: \{ type: 'string', maxLength: 120 \}/);
assert.match(edge, /flow: \{ type: 'string', maxLength: 520 \}/);
assert.match(edge, /normaliseResult/);
assert.match(edge, /originalVariations/);
assert.match(edge, /missingRequiredRules/);
assert.match(edge, /REQUIRED_FLOW_RULES/);
assert.match(edge, /hasCompleteSentence/);
assert.match(edge, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(edge, /Die erste Antwort war unvollständig/);
assert.match(page, /hasCompleteTrainingExerciseShortContent/);
assert.match(page, /Die PDF-Kurzfassung enthält einen unvollständigen Satz/);
assert.match(edge, /Variation \${index \+ 1}/);
assert.match(edge, /content: 700/);
assert.match(edge, /materials: 100/);
assert.match(edge, /coaching: 250/);
assert.match(edge, /const flowLimit = Math\.max\(340, Math\.min\(500/);
assert.match(edge, /const attemptFlowLimit = Math\.max\(320/);
assert.match(edge, /Variationen werden unverändert aus dem Original übernommen/);
assert.match(edge, /Unterscheide Balleroberung und Ballverlust exakt/);
assert.match(edge, /Kontaktbegrenzungen, die Sperre des Anspielers/);
assert.match(edge, /Spiel ohne Abseits/);
assert.match(edge, /Anspieler darf nach dem Einspielen nicht mehr angespielt werden/);
assert.match(edge, /Nach Balleroberung zuerst zum Anspieler passen/);
assert.match(edge, /Diese Pflichtangaben fehlten oder waren falsch/);
assert.match(edge, /nicht alle Pflichtregeln/);
assert.doesNotMatch(edge, /variations: \{\s*type: 'array'/);
assert.match(edge, /coachingPoints: zwei bis vier kurze Einträge ausschließlich aus coachingpunkte/);
assert.match(page, /Inhalte: Aufbau, Ablauf & Variationen/);
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY/);

console.log('training-exercise-ai-short-text: ok');
