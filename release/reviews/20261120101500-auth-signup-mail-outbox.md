# Auth signup mail outbox

The TEST database ran this exact migration in a rolled-back transaction with a synthetic auth user. Assertions covered service-role enqueue, duplicate webhook IDs, blocked public RPC access, incorrect worker credentials, exclusive claims, stale leases, retry state, superseded confirmation tokens, and deletion after successful delivery. The test did not send email.

LIVE already has pg_cron, pg_net and Vault. Schedule the worker in each environment using its public app origin. The worker authenticates with a separate project-local Vault secret. Jobs clear after delivery or expiry and wait for a committed, unconfirmed matching Supabase Auth token before sending. Other auth mail actions retain the existing transport.
