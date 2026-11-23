import assert from 'node:assert/strict';
import { removeOuterWhiteBackground } from '../lib/logoBackground.mjs';
import cutout from '../server/lib/tournamentLogoCutout.cjs';

const { cleanTournamentLogo } = cutout;
const width = 24;
const height = 24;
const image = { width, height, data: Buffer.alloc(width * height * 4, 255) };
const red = [160, 8, 30, 255];
const white = [255, 255, 255, 255];
const setPixel = (x, y, color) => image.data.set(color, (y * width + x) * 4);
for (let y = 6; y <= 17; y++) {
  for (let x = 6; x <= 17; x++) {
    if (x === 6 || x === 17 || y === 6 || y === 17) setPixel(x, y, red);
  }
}
setPixel(5, 8, [231, 222, 230, 255]);
setPixel(2, 2, [192, 192, 194, 255]);
const cleaned = cleanTournamentLogo(image, removeOuterWhiteBackground);
assert.equal(cleaned.width, 12);
assert.equal(cleaned.height, 12);
assert.deepEqual([...cleaned.data.subarray(0, 4)], red);
const center = (6 * cleaned.width + 6) * 4;
assert.deepEqual([...cleaned.data.subarray(center, center + 4)], white);
assert.equal(image.data[(8 * width + 5) * 4 + 3], 0);
assert.equal(image.data[(2 * width + 2) * 4 + 3], 0);
const priorCutout = { width, height, data: Buffer.from(image.data) };
const before = Buffer.from(priorCutout.data);
assert.equal(cleanTournamentLogo(priorCutout, removeOuterWhiteBackground), priorCutout);
assert.deepEqual(priorCutout.data, before);
console.log('PASS tournament crest fringe and speckle cleanup, transparent margin crop, enclosed whites and existing cutouts');
