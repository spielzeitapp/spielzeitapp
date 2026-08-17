/**
 * PARENT-INVITE.ALREADY-LINKED-MESSAGE — trainer send maps already_linked only.
 * Run: node scripts/parent-invite-already-linked-message-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inviteLib = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/team/PlayerGuardiansPanel.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/parent/send-invite.js'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');

const LINKED_MSG =
  'Dieses Elternkonto ist bereits mit dem Spieler verknüpft. Es ist keine neue Einladung erforderlich.';
const GENERIC_SEND = 'Einladung konnte nicht gesendet werden.';
const PARENT_ALREADY = 'Dieses Kind ist bereits mit deinem Konto verknüpft.';

function sliceSendErrorMap(src) {
  const start = src.indexOf("const err = String(payload.error ?? 'send_failed');");
  assert.ok(start > 0, 'send error map present');
  const mapStart = src.indexOf('const messages: Record<string, string> = {', start);
  const mapEnd = src.indexOf('};', mapStart);
  assert.ok(mapStart > 0 && mapEnd > mapStart, 'send messages object');
  return src.slice(mapStart, mapEnd + 2);
}

function sliceCreateErrorMap(src) {
  const marker = "if (status !== 'created') {";
  const start = src.indexOf(marker);
  assert.ok(start > 0, 'create status map present');
  const mapStart = src.indexOf('const messages: Record<string, string> = {', start);
  const mapEnd = src.indexOf('};', mapStart);
  assert.ok(mapStart > 0 && mapEnd > mapStart, 'create messages object');
  return src.slice(mapStart, mapEnd + 2);
}

const sendMap = sliceSendErrorMap(inviteLib);
const createMap = sliceCreateErrorMap(inviteLib);

assert.ok(sendMap.includes("already_linked:"), 'maps already_linked send error');
assert.ok(sendMap.includes(LINKED_MSG), 'already_linked send text');
assert.ok(inviteLib.includes(`message: messages[err] ?? '${GENERIC_SEND}'`), 'generic send fallback unchanged');

assert.ok(sendMap.includes("Forbidden: 'Keine Berechtigung.'"), 'Forbidden unchanged');
assert.ok(sendMap.includes("invalid_email:"), 'invalid_email unchanged');
assert.ok(
  sendMap.includes('parent_invite_refuses_live_domain') ||
    sendMap.includes('parent_invite_origin_ref_mismatch'),
  'environment/origin error mapping kept',
);
assert.ok(!sendMap.includes('smtp'), 'does not swallow SMTP as already_linked');
assert.ok(!sendMap.includes('invite_create_failed'), 'does not remap generic create failure');
assert.ok(!sendMap.includes('Unauthorized'), 'does not remap session errors');

assert.ok(createMap.includes("already_linked:"), 'maps already_linked create status');
assert.ok(createMap.includes(LINKED_MSG), 'already_linked create text');
assert.ok(createMap.includes("invalid_email:"), 'create invalid_email unchanged');
assert.ok(createMap.includes("forbidden:"), 'create forbidden unchanged');

// Parent-facing redeem/preview copy stays distinct from trainer send copy
assert.ok(inviteLib.includes(PARENT_ALREADY), 'parent already_linked preview text unchanged');
assert.ok(accept.includes(PARENT_ALREADY) || inviteLib.includes("already_linked: 'Dieses Kind"), 'accept still uses parent copy');

// Trainer UI: known linked email does not call send
assert.ok(panel.includes("parents.some("), 'panel checks existing guardians');
assert.ok(panel.includes(LINKED_MSG), 'panel shows trainer already-linked text');
assert.ok(panel.includes('sendParentEmailInvite'), 'send path still present for new emails');

const sendIdx = panel.indexOf('const result = await sendParentEmailInvite');
const linkedIdx = panel.indexOf(LINKED_MSG);
assert.ok(linkedIdx > 0 && sendIdx > linkedIdx, 'already-linked check runs before send');

// API lock/origin/send behavior not rewritten
assert.ok(api.includes('create_parent_link_invite'), 'send-invite still creates via RPC');
assert.ok(api.includes('resolveInviteOrigin'), 'origin helper unchanged');
assert.ok(!api.includes(LINKED_MSG), 'send-invite does not rewrite mail/API copy');
assert.ok(!api.includes("error: 'already_linked'"), 'no new API already_linked branch');

console.log('parent-invite-already-linked-message-test: OK');
