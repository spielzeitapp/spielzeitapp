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
assert.match(edge, /OPENAI_SHORTEN_MODEL/);
assert.match(edge, /\?\? 'gpt-4\.1'/);
assert.match(edge, /can_manage_club_venues/);
assert.match(edge, /https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(edge, /type: 'json_schema'/);
assert.match(edge, /store: false/);
assert.match(edge, /setup: \{ type: 'string', maxLength: setupLimit \}/);
assert.match(edge, /flow: \{ type: 'string', maxLength: flowLimit \}/);
assert.match(edge, /minItems: variationCount/);
assert.match(edge, /maxItems: variationCount/);
assert.match(edge, /maxLength: variationItemLimit/);
assert.match(edge, /normaliseResult/);
assert.match(edge, /normalisationIssues/);
assert.match(edge, /originalVariations/);
assert.match(edge, /normaliseChecklist/);
assert.match(edge, /normaliseVerification/);
assert.match(edge, /structuredAiCall/);
assert.match(edge, /training_exercise_fact_checklist/);
assert.match(edge, /training_exercise_fact_verification/);
assert.match(edge, /hasCompleteSentence/);
assert.match(edge, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(page, /hasCompleteTrainingExerciseShortContent/);
assert.match(page, /Die PDF-Kurzfassung enthält einen unvollständigen Satz/);
assert.match(edge, /Variation \${index \+ 1}/);
assert.match(edge, /content: 760/);
assert.match(edge, /materials: 100/);
assert.match(edge, /coaching: 250/);
assert.match(edge, /const flowLimit = Math\.min\(500, LIMITS\.content - reservedSetupBudget - variationBudget\)/);
assert.match(edge, /const flowTarget = Math\.max\(180/);
assert.match(edge, /if \(next === content\) return null/);
assert.match(edge, /Faktenliste ist nur eine zusätzliche Prüfhilfe und kann selbst unvollständig sein/);
assert.match(edge, /auch wenn sie nicht in mustKeepFacts steht/);
assert.match(edge, /Aufbau und Ablauf um mindestens \$\{contentLength - LIMITS\.content \+ 15\} Zeichen kürzen/);
assert.match(edge, /variationCount,/);
assert.match(edge, /variationFacts/);
assert.match(edge, /Prüfe jede Variation einzeln und in der ursprünglichen Reihenfolge/);
assert.match(edge, /eine beliebige Fußballübung/);
assert.match(edge, /Jeder Eintrag aus mustKeepFacts muss semantisch eindeutig/);
assert.match(edge, /Akzeptiere sinngetreue Kurzformen, Synonyme, Abkürzungen/);
assert.match(edge, /Dynamic fact verification rejected summary/);
assert.match(edge, /keine gegen das Original geprüfte Kurzfassung/);
assert.doesNotMatch(edge, /REQUIRED_FLOW_RULES/);
assert.doesNotMatch(edge, /Rolle\/Farbe Grün/);
assert.match(edge, /variations: \{/);
assert.match(edge, /coachingPoints: zwei bis vier kurze Einträge ausschließlich aus den ursprünglichen Coachingpunkten/);
assert.match(page, /Inhalte: Aufbau, Ablauf & Variationen/);
assert.match(page, /KI-Versuch abgelehnt:/);
assert.match(page, /Die bisherige Kurzfassung bleibt unverändert angezeigt/);
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY/);

console.log('training-exercise-ai-short-text: ok');
