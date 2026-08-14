/**
 * STEP 4: Pure Logic-Checks (kein Netzwerk).
 * node scripts/step4-season-logic-check.mjs
 */

function computeNextAgeGroup(ageGroup) {
  const trimmed = ageGroup.trim();
  const m = trimmed.match(/^U(\d{1,2})([a-z]?)$/i);
  if (!m) return trimmed;
  const next = parseInt(m[1], 10) + 1;
  const suffix = m[2] ?? '';
  return `U${next}${suffix}`;
}

function computeNextSeasonName(seasonName) {
  const trimmed = seasonName.trim();
  const m = trimmed.match(/^(\d{4})\/(\d{2})$/);
  if (!m) return trimmed;
  const startYear = parseInt(m[1], 10);
  const endShort = parseInt(m[2], 10);
  const endYear = endShort < 100 ? Math.floor(startYear / 100) * 100 + endShort : endShort;
  const nextStart = endYear;
  const nextEndShort = (nextStart + 1) % 100;
  return `${nextStart}/${String(nextEndShort).padStart(2, '0')}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(computeNextAgeGroup('U11') === 'U12', 'U11→U12');
assert(computeNextSeasonName('2025/26') === '2026/27', '2025/26→2026/27');
assert(['active', 'draft', 'archived'].includes('draft'), 'status set');

console.log('STEP4 season logic checks OK');
