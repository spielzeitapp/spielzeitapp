/**
 * LIVE-FEED.1 — CTA URL validation (no DB).
 * Run: node scripts/live-feed1-cta-test.mjs
 */

let failed = 0;

function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

function safeText(v) {
  return String(v ?? '').trim();
}

const FEED_CTA_LABEL_MAX = 80;
const FEED_CTA_LABEL_FALLBACK = 'Link öffnen';

function validateFeedCtaUrl(raw) {
  const trimmed = safeText(raw);
  if (!trimmed) return { ok: true, url: null };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'protocol' };
  }
  return { ok: true, url: parsed.toString() };
}

function sanitizeFeedCtaLabel(raw) {
  const plain = safeText(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.slice(0, FEED_CTA_LABEL_MAX);
}

function resolveFeedCtaLabel(raw) {
  return sanitizeFeedCtaLabel(raw) ?? FEED_CTA_LABEL_FALLBACK;
}

const cloudflare =
  'https://customer-lr22h4x2vgb8awys.cloudflarestream.com/fc5d2eb9d083a97be477b7cfb8804073/iframe';

assert(validateFeedCtaUrl(null).ok && validateFeedCtaUrl(null).url === null, 'empty URL → no CTA');
assert(validateFeedCtaUrl('').ok && validateFeedCtaUrl('').url === null, 'blank URL → no CTA');
assert(validateFeedCtaUrl(cloudflare).ok === true, 'Cloudflare https accepted');
assert(validateFeedCtaUrl('javascript:alert(1)').ok === false, 'javascript: rejected');
assert(validateFeedCtaUrl('data:text/html,hi').ok === false, 'data: rejected');
assert(validateFeedCtaUrl('file:///etc/passwd').ok === false, 'file: rejected');
assert(resolveFeedCtaLabel('') === 'Link öffnen', 'empty label → fallback');
assert(resolveFeedCtaLabel('Livestream ansehen') === 'Livestream ansehen', 'label kept');
assert(resolveFeedCtaLabel('<b>Hack</b>').includes('<') === false, 'HTML stripped from label');
assert(resolveFeedCtaLabel('x'.repeat(100)).length === 80, 'label max 80');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall live-feed1 checks passed');
