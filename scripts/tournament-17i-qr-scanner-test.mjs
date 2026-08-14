/**
 * STEP 17I — QR scanner loop / phase helpers (no camera).
 * Run: node scripts/tournament-17i-qr-scanner-test.mjs
 */

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

function isPaused(phase, saving) {
  if (saving) return true;
  return phase !== 'scanning';
}

function isStopped(cancelled, stopped) {
  return cancelled || stopped;
}

function shouldCloseScanner({ userClose, successSaved, unsupported, emptyFrame }) {
  if (userClose) return true;
  if (successSaved) return true;
  if (unsupported) return false;
  if (emptyFrame) return false;
  return false;
}

assert(isPaused('scanning', false) === false, 'scanning not paused');
assert(isPaused('validating', false) === true, 'validating paused');
assert(isPaused('scanning', true) === true, 'saving pauses scan');
assert(isStopped(false, false) === false, 'active loop not stopped');
assert(isStopped(true, false) === true, 'cancelled stops loop');
assert(shouldCloseScanner({ userClose: false, successSaved: false, unsupported: true, emptyFrame: false }) === false, 'unsupported keeps open');
assert(shouldCloseScanner({ userClose: false, successSaved: false, unsupported: false, emptyFrame: true }) === false, 'empty frame keeps open');
assert(shouldCloseScanner({ userClose: true, successSaved: false, unsupported: false, emptyFrame: false }) === true, 'user close');
assert(shouldCloseScanner({ userClose: false, successSaved: true, unsupported: false, emptyFrame: false }) === true, 'success closes');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall 17i qr checks passed');
