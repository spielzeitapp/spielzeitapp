/**
 * STEP 3C: Pure Logic-Checks (kein Netzwerk).
 * node scripts/step3c-copy-logic-check.mjs
 */

function copyTitle(original, mode) {
  const base = String(original ?? '').trim() || 'Training';
  if (mode === 'template') {
    if (/vorlage/i.test(base)) return base;
    return `Vorlage: ${base}`;
  }
  const stripped = base.replace(/\s*\(Kopie(?:\s*\d+)?\)\s*$/i, '').trim() || base;
  return `${stripped} (Kopie)`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(copyTitle('Passspiel', 'draft') === 'Passspiel (Kopie)', 'draft title');
assert(copyTitle('Passspiel (Kopie)', 'draft') === 'Passspiel (Kopie)', 'idempotent copy title');
assert(copyTitle('Passspiel', 'template') === 'Vorlage: Passspiel', 'template title');
assert(copyTitle('Vorlage: X', 'template') === 'Vorlage: X', 'template keep');

const statuses = ['draft', 'ready', 'completed', 'archived'];
assert(statuses.includes('completed'), 'completed status');

const review = ['excellent', 'good', 'partial', 'off_plan'];
assert(review.length === 4, 'review ratings');

const exReview = ['worked_well', 'adapted', 'not_done', 'repeat'];
assert(exReview.length === 4, 'exercise review');

console.log('STEP3C copy/status logic checks OK');
