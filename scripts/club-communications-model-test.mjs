import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPEAKER_SECTIONS, mergeGeneratedSections, renderSpeakerTemplate, speakerCueTime, deckGains } from '../src/lib/clubCommunicationsModel.ts';

test('relative cues match the source example and respect Vienna DST', () => {
  assert.equal(speakerCueTime('2026-09-19T15:00:00Z', -15).label, '16:45');
  assert.equal(speakerCueTime('2026-01-10T16:00:00Z', -15).label, '16:45');
  assert.equal(speakerCueTime('2026-09-19T22:05:00Z', -15).dayKey, '2026-09-19');
  assert.throws(() => speakerCueTime('2026-09-19T17:00:00', -15));
});
test('halftime and fulltime remain manually triggered; no assumed fixed end time', () => {
  for (const id of ['halftime', 'second_half', 'fulltime']) {
    const section = DEFAULT_SPEAKER_SECTIONS.find(s => s.id === id);
    assert.equal(section.offsetMinutes, null);
    assert.notEqual(section.trigger, 'scheduled');
  }
  assert.equal(new Set(DEFAULT_SPEAKER_SECTIONS.map(s => s.id)).size, DEFAULT_SPEAKER_SECTIONS.length);
});
test('missing data stays visible and zero is a valid value', () => {
  const result = renderSpeakerTemplate('{{club}} {{score}} {{opponent}} {{score}}', { club: 'USC', score: 0 });
  assert.equal(result.text, 'USC 0 [OFFEN: opponent] 0');
  assert.deepEqual(result.missing, ['opponent']);
  assert.deepEqual(renderSpeakerTemplate('{{points}}', { points: NaN }).missing, ['points']);
});
test('generation preserves manual and approved text without aliasing input data', () => {
  const original = { ...DEFAULT_SPEAKER_SECTIONS[0], text: 'Eigene Ansage', editedByUser: true, sourceFactIds: ['fact-1'] };
  const approved = { ...DEFAULT_SPEAKER_SECTIONS[1], text: 'Freigegeben', status: 'approved' };
  const fresh = { ...original, text: 'KI-Vorschlag' };
  const result = mergeGeneratedSections([original, approved], [fresh, { ...approved, text: 'Neu' }]);
  assert.equal(result[0].text, 'Eigene Ansage');
  assert.equal(result[1].text, 'Freigegeben');
  result[0].sourceFactIds.push('fact-2');
  assert.deepEqual(original.sourceFactIds, ['fact-1']);
  const replacement = mergeGeneratedSections([original], [fresh], [original.id])[0];
  assert.equal(replacement.text, 'KI-Vorschlag');
  assert.equal(replacement.status, 'needs_review');
  assert.equal(replacement.editedByUser, false);
});
test('generation rejects duplicate IDs and never drops an existing section', () => {
  assert.throws(() => mergeGeneratedSections([DEFAULT_SPEAKER_SECTIONS[0]], [DEFAULT_SPEAKER_SECTIONS[0], DEFAULT_SPEAKER_SECTIONS[0]]));
  assert.equal(mergeGeneratedSections(DEFAULT_SPEAKER_SECTIONS, []).length, DEFAULT_SPEAKER_SECTIONS.length);
});
test('A/B crossfade and speaking attenuation are bounded and deterministic', () => {
  assert.deepEqual(deckGains(0, 1, 1, false), { a: 1, b: 0 });
  assert.deepEqual(deckGains(1, 1, 1, false), { a: 0, b: 1 });
  const normal = deckGains(0.5, 1, 1, false);
  const speaking = deckGains(0.5, 1, 1, true);
  assert.ok(Math.abs(normal.a ** 2 + normal.b ** 2 - 1) < 1e-12);
  assert.ok(Math.abs(speaking.a - normal.a * 0.2) < 1e-12);
  assert.ok(Math.abs(speaking.b - normal.b * 0.2) < 1e-12);
  assert.deepEqual(deckGains(0.5, 0, 0, true), { a: 0, b: 0 });
  assert.throws(() => deckGains(NaN, 1, 1, false));
});
