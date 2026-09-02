import assert from 'node:assert/strict';
import fs from 'node:fs';

const exercises = fs.readFileSync('src/lib/trainingExercises.ts', 'utf8');
const sessions = fs.readFileSync('src/lib/trainingSessions.ts', 'utf8');
const libraryPage = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');
const sessionsPage = fs.readFileSync('src/manager/ManagerTrainingSessionsPage.tsx', 'utf8');

assert.match(exercises, /export async function deleteTrainingExercise/);
assert.match(exercises, /const usage = await countExerciseUsage\(id\)/);
assert.match(exercises, /await removeTrainingExerciseSketch\(imagePath\)/);
assert.match(sessions, /export async function deleteTrainingSession/);
assert.match(sessions, /\.from\('training_sessions'\)[\s\S]*?\.delete\(\)/);
assert.match(sessions, /Trainerprüfungs-Dokumentation/);
assert.match(libraryPage, /Archivieren[\s\S]*?Löschen…[\s\S]*?'Löschen'/);
assert.match(libraryPage, /endgültig löschen\?/);
assert.match(sessionsPage, /deleteTrainingSession/);
assert.match(sessionsPage, /Öffnen<\/Link><button[\s\S]*?'Löschen'/);
assert.match(sessionsPage, /Der verknüpfte Trainingstermin bleibt bestehen/);

console.log('training-delete-actions: ok');
