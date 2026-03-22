-- Browser-Push-Subscriptions (API: api/push/subscribe.js → public.push_subscriptions)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  "auth" text NOT NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push Subscriptions (Browser); Schreiben typischerweise per Service Role aus Vercel.';

-- updated_at (Funktion public.set_updated_at aus früheren Migrationen, z. B. 20260220100000)
DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Keine Client-Policies: Inserts nur über Service Role (API). Optional Lesen für Debugging:
-- (Anpassen nach Bedarf)
