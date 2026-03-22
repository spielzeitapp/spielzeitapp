/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional: Web-Push VAPID (public); gleiche Rolle wie NEXT_PUBLIC_VAPID_PUBLIC_KEY nach vite.config define */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
