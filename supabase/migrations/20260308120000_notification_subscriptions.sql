-- Web Push: Browser-Subscriptions pro User (MVP Eltern)
-- Nach Deploy: SUPABASE_SERVICE_ROLE_KEY nur serverseitig (Vercel / API), nie im Client.

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  "auth" text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_subscriptions_endpoint_key
  ON public.notification_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS notification_subscriptions_user_id_idx
  ON public.notification_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS notification_subscriptions_active_idx
  ON public.notification_subscriptions (user_id)
  WHERE is_active = true;

COMMENT ON TABLE public.notification_subscriptions IS 'Web Push Subscriptions (Browser); Versand später per Edge Function / Backend mit VAPID private key.';

-- updated_at (Funktion public.set_updated_at aus früheren Migrationen)
DROP TRIGGER IF EXISTS notification_subscriptions_set_updated_at ON public.notification_subscriptions;
CREATE TRIGGER notification_subscriptions_set_updated_at
  BEFORE UPDATE ON public.notification_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Keine direkten Client-Policies: Schreiben nur über Service Role (API-Route).
-- Optional Lesen für eigenes Profil (Debugging):
CREATE POLICY "notification_subscriptions_select_own"
  ON public.notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
