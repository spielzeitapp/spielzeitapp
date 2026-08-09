/**
 * Shared ÖFB team-name normalizer (CJS) for /api/oefb/schedule and node tests.
 * Keep in sync with src/lib/oefbTeamNameNormalize.ts
 *
 * Lives under api/_lib so Vercel does NOT treat it as a Serverless Function.
 */
function normalizeOefbImportedTeamName(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/\(\s*U[\s\-]?11\s*\)|\bU[\s\-]?11\b/gi, ' ');
  s = s.replace(/\(\s*\)/g, ' ');
  s = s.replace(/\s*[–—]\s*/g, ' – ');
  s = s.replace(/(?:\s*–\s*){2,}/g, ' – ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^(?:[–—\-]\s*)+|(?:\s*[–—\-])+$/g, '').trim();
  return s;
}

function describeOefbOpponentCorrection(existingOpponent, nextOpponent) {
  const a = String(existingOpponent ?? '').trim();
  const b = String(nextOpponent ?? '').trim();
  if (!a || !b || a === b) return null;
  return `${a} → ${b}`;
}

module.exports = {
  normalizeOefbImportedTeamName,
  describeOefbOpponentCorrection,
};
