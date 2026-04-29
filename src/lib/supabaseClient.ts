import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
