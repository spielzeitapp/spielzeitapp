import { createClient } from "@supabase/supabase-js";
import {
  isStagingApp,
  supabaseUrlLooksLikeLive,
  supabaseUrlLooksLikeStaging,
  LIVE_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
} from "./appEnvironment";
import { captureAuthCallbackTypeFromUrl } from './authRedirect';

const PARENT_INVITE_TOKEN_STORAGE_KEY = 'spz_parent_invite_token';
const PARENT_INVITE_TOKEN_LOCAL_KEY = 'spz_parent_invite_token_v1';
const PARENT_INVITE_STASH_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Capture invite token early (Magic Link), before Auth hash processing rewrites the URL.
 */
export function captureParentInviteTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const path = window.location.pathname || '';
    const pathMatch = path.match(/\/app\/parent-invite\/([0-9a-fA-F]{48})\/?$/);
    let raw = '';
    if (pathMatch?.[1]) {
      raw = pathMatch[1];
    } else {
      const search = window.location.search.startsWith('?')
        ? window.location.search.slice(1)
        : window.location.search;
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      raw = new URLSearchParams(search).get('t') || new URLSearchParams(hash).get('t') || '';
    }
    const token = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    if (!/^[0-9a-f]{48}$/.test(token)) return;

    try {
      window.sessionStorage.setItem(PARENT_INVITE_TOKEN_STORAGE_KEY, token);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.setItem(
        PARENT_INVITE_TOKEN_LOCAL_KEY,
        JSON.stringify({ token, expiresAt: Date.now() + PARENT_INVITE_STASH_TTL_MS }),
      );
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

captureAuthCallbackTypeFromUrl();
captureParentInviteTokenFromUrl();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (isStagingApp() && supabaseUrlLooksLikeLive(supabaseUrl)) {
  throw new Error(
    `[config] Staging darf nicht auf Live-Supabase (${LIVE_SUPABASE_PROJECT_REF}) zeigen. ` +
      `VITE_SUPABASE_URL muss spielzeitapp-staging (${STAGING_SUPABASE_PROJECT_REF}) sein.`,
  );
}

if (import.meta.env.VITE_APP_ENV === "production" && supabaseUrlLooksLikeStaging(supabaseUrl)) {
  console.error(
    `[config] Production VITE_APP_ENV with staging Supabase URL (${STAGING_SUPABASE_PROJECT_REF}) — prüfen.`,
  );
}

const REMEMBER_ME_KEY = "spz_remember_me";

function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) === "1";
  } catch {
    return true;
  }
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (remember) {
      window.localStorage.setItem(REMEMBER_ME_KEY, "1");
    } else {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

const authStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      const remember = getRememberMePreference();
      const active = remember ? window.localStorage : window.sessionStorage;
      return active.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      const remember = getRememberMePreference();
      const active = remember ? window.localStorage : window.sessionStorage;
      const inactive = remember ? window.sessionStorage : window.localStorage;
      active.setItem(key, value);
      inactive.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
