/**
 * Lightweight checks for guardian email linking helpers (no test runner).
 * Run: npx tsx scripts/check-player-guardian-link.ts
 * Pure helpers mirrored from app code (no Vite/supabase import).
 */

const ACCOUNT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidAccountEmail(value: string): boolean {
  return ACCOUNT_EMAIL_RE.test(value.trim());
}

function normalizeGuardianEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function guardianDisplayLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
  fallback = 'Elternaccount',
): string {
  const name = displayName != null ? String(displayName).trim() : '';
  if (name.length > 0 && name.toLowerCase() !== 'null') return name;
  const mail = email != null ? String(email).trim() : '';
  if (mail.length > 0) return mail;
  return fallback;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeGuardianEmail('  Petra@Example.AT ') === 'petra@example.at', 'normalize email');
assert(isValidAccountEmail('petra@example.at'), 'valid email');
assert(!isValidAccountEmail('petra'), 'partial email invalid');
assert(!isValidAccountEmail('petra@'), 'incomplete email invalid');
assert(!isValidAccountEmail(''), 'empty email invalid');

assert(guardianDisplayLabel('Petra Gasteiner', 'p@x.at') === 'Petra Gasteiner', 'prefer name');
assert(guardianDisplayLabel(null, 'p@x.at') === 'p@x.at', 'fallback email');
assert(guardianDisplayLabel(null, null) === 'Elternaccount', 'neutral fallback');
assert(guardianDisplayLabel('null', 'p@x.at') === 'p@x.at', 'reject literal null string');
assert(guardianDisplayLabel('  ', null) === 'Elternaccount', 'blank name');

console.log('check-player-guardian-link: ok');
