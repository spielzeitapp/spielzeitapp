import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const tmp = mkdtempSync(join(tmpdir(), "tournament-template-"));
try {
  const file = join(tmp, "template.cjs");
  require("esbuild").buildSync({
    entryPoints: ["src/lib/tournamentLineupTemplate.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: file,
    logLevel: "silent",
  });
  const { emptyTournamentTemplate, normalizeTournamentTemplate, tournamentTemplateReady: ready } = require(
    file,
  );
  const squad = ["a", "b", "c", "d", "e", "f"];
  const template = emptyTournamentTemplate(squad);
  assert.equal(ready(template, squad), false);
  for (const n of [1, 2])
    Object.assign(template.variants[n].slots, {
      GK: "a",
      LB: "b",
      RB: "c",
      LW: "d",
      RW: "e",
    });
  assert.equal(ready(template, squad), true);
  template.startVariant = 2;
  assert.equal(ready(template, squad), true);
  assert.equal(ready(template, [...squad, "g"]), false);
  assert.equal(ready(template, squad.slice(0, 5)), false);
  assert.equal(ready(template, squad, ["a"]), false);
  const bad = structuredClone(template);
  bad.variants[2].slots.LB = "a";
  assert.equal(ready(bad, squad), false);
  const missing = structuredClone(template);
  missing.variants[2].slots.GK = null;
  assert.equal(ready(missing, squad), false);
  const hidden = structuredClone(template);
  hidden.variants[2].slots.ST = "f";
  assert.equal(ready(hidden, squad), false);
  const different = structuredClone(template);
  different.variants[2].formationId = "1-2-1-2";
  different.variants[2].slots.CM = "f";
  assert.equal(ready(different, squad), false);
  const single = emptyTournamentTemplate(squad, '1-2-2', 'single');
  Object.assign(single.variants[1].slots, {GK:'a', LB:'b', RB:'c', LW:'d', RW:'e'});
  assert.equal(ready(single, squad), true, 'single lineup does not require a second block');
  assert.equal(ready(single, squad, ['a']), false, 'injury guards apply to single lineup');
  const normalized = normalizeTournamentTemplate(single);
  assert.deepEqual(normalized.variants[2], normalized.variants[1]);
  assert.equal(normalized.startVariant, 1);
  assert.equal(single.variants[2].slots.GK, null, 'normalizing does not mutate the draft');
  const duplicateSingle = structuredClone(single);
  duplicateSingle.variants[1].slots.LB = 'a';
  assert.equal(ready(duplicateSingle, squad), false);
  const legacy = structuredClone(template);
  delete legacy.lineupMode;
  legacy.variants[2].slots.GK = null;
  assert.equal(ready(legacy, squad), false, 'legacy plans still require both blocks');
  console.log(
    "PASS: both complete blocks, either start block, draft, duplicate, injury, changed squad and incompatible formation.",
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
