import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/events/TrainingAttendancePanel.tsx', import.meta.url), 'utf8');
const badgeProps = source.match(/<PlayerSpecialStatusBadges\s+([\s\S]*?)\/>/)[1];
const expression = badgeProps.match(/isInjured=\{([^}]+)\}/)[1];
const showProfileInjury = new Function('player', 'status', `return Boolean(${expression});`);
assert.equal(showProfileInjury({ is_injured: true }, 'injured'), false,
  'Training injury badge must not be repeated by profile badge');
for (const status of ['present', 'absent', 'sick', 'external']) {
  assert.equal(showProfileInjury({ is_injured: true }, status), true,
    'Keep distinct profile information when training badge differs');
}
assert.equal(showProfileInjury({ is_injured: false }, 'injured'), false);
assert.match(source, /label=\{trainingAttendanceLabel\(status\)\}/,
  'Primary training status badge stays visible');
assert.match(badgeProps, /isLaz=\{player\.is_laz_player\}/,
  'LAZ profile information stays unchanged');
console.log('PASS: one injury badge, distinct profile information and LAZ retained');
