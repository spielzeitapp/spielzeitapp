import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/components/schedule/scheduleEventViewUtils.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { formatCompactListDateParts, formatHeroDateParts } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
for (const [date, wd] of [
  ['2026-06-01', 'MO'], ['2026-06-02', 'DI'], ['2026-05-20', 'MI'],
  ['2026-06-11', 'DO'], ['2026-06-12', 'FR'], ['2026-06-13', 'SA'], ['2026-06-14', 'SO'],
]) {
  assert.equal(formatCompactListDateParts(`${date}T15:30:00Z`).wd, wd);
  assert.equal(formatHeroDateParts(`${date}T15:30:00Z`).wd, wd);
}
// Vienna's next day, not the UTC weekday.
assert.equal(formatCompactListDateParts('2026-06-10T22:30:00Z').wd, 'DO');
assert.equal(formatCompactListDateParts('2026-06-11T15:30:00Z').day, '11');
assert.equal(formatCompactListDateParts('invalid').wd, '—');
assert.equal(formatCompactListDateParts(null).wd, '—');
console.log('PASS: all seven short weekdays, archived dates, Vienna timezone and invalid input');
