/// <reference types="node" />

/** Next.js: öffentliche Client-Env (Build-Zeit) */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  }
}
