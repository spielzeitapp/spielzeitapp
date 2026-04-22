/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Öffentlicher VAPID-Key (Client); muss mit Server-Env VAPID_PUBLIC_KEY übereinstimmen */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Wenn 'true': nach Matchday-RPC optional /api/send-reminders triggern (nur Tests) */
  readonly VITE_MATCHDAY_PUSH_TEST?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
