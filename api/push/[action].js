// One deployed function; handlers retain their own authorization and method checks.
import subscribe from '../../server/push/subscribe.js';
import unsubscribe from '../../server/push/unsubscribe.js';
import sendTeam from '../../server/push/send-team.js';
import test from '../../server/push/test.js';
const handlers = new Map([
  ['subscribe', subscribe], ['unsubscribe', unsubscribe],
  ['send-team', sendTeam], ['test', test],
]);
export default function handler(req, res) {
  const path = new URL(req.url, 'https://localhost').pathname;
  const action = path.match(/^\/api\/push\/([^/]+)\/?$/)?.[1];
  const target = handlers.get(action);
  if (!target) return res.status(404).json({ error: 'Unbekannter Push-Endpunkt.' });
  return target(req, res);
}
