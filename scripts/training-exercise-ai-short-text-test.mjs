import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, client, edge] = await Promise.all([
  readFile(new URL('../src/manager/ManagerTrainingLibraryPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/trainingExerciseAiShortText.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/shorten-training-exercise/index.ts', import.meta.url), 'utf8'),
]);

assert.match(page, /Mit KI kürzen/);
assert.match(page, /Neu vorschlagen \(ohne KI\)/);
assert.match(page, /createTrainingExerciseAiShortText/);
assert.match(client, /supabase\.functions\.invoke<AiShortTextResponse>/);
assert.match(client, /shorten-training-exercise/);
assert.match(edge, /OPENAI_API_KEY/);
assert.match(edge, /can_manage_club_venues/);
assert.match(edge, /https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(edge, /type: 'json_schema'/);
assert.match(edge, /content: 300/);
assert.match(edge, /materials: 100/);
assert.match(edge, /coaching: 250/);
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY/);

console.log('training-exercise-ai-short-text: ok');
