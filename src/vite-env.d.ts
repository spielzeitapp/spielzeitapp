/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** VAPID public key (web-push generate-vapid-keys), nur öffentlich */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Optional: volle URL zur Subscribe-API (z. B. https://app.example.com/api/push/subscribe). Default: /api/push/subscribe */
  readonly VITE_PUSH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
