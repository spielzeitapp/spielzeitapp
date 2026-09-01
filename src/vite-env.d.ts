/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** production | staging | development — steuert TEST-Badge und Config-Guards */
  readonly VITE_APP_ENV?: string;
  /** STEP 3+: team_season_players Dual-Read (Default false) */
  readonly VITE_ROSTER_JOIN_V1?: string;
  /** Optional: Fallback für Auth-Redirects ohne window (selten); Browser-Origin hat Vorrang */
  readonly VITE_APP_BASE_URL?: string;
  /** Öffentlicher VAPID-Key (Client); muss mit Server-Env VAPID_PUBLIC_KEY übereinstimmen */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Wenn 'true': nach Matchday-RPC optional /api/send-reminders triggern (nur Tests) */
  readonly VITE_MATCHDAY_PUSH_TEST?: string;
  /** Öffentlicher Cloudflare-Turnstile-Site-Key für Supabase Auth */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
