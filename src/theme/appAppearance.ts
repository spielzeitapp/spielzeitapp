import { useSyncExternalStore } from 'react';

export type AppAppearance = 'light' | 'dark';
const STORAGE_KEY = 'spielzeit.app.appearance.v1';
const CHANGE_EVENT = 'spielzeit:app-appearance-changed';
let fallback: AppAppearance = 'dark';
let storageUnavailable = false;

function readAppearance(): AppAppearance {
  if (typeof window === 'undefined') return 'dark';
  if (storageUnavailable) return fallback;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' ? 'light' : 'dark';
  } catch {
    storageUnavailable = true;
    return fallback;
  }
}

function subscribe(update: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) update();
  };
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener('storage', onStorage);
  };
}

function toggleAppearance() {
  fallback = readAppearance() === 'dark' ? 'light' : 'dark';
  try {
    window.localStorage.setItem(STORAGE_KEY, fallback);
  } catch {
    storageUnavailable = true;
    // Keep the choice for this session when device storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAppAppearance() {
  const appearance = useSyncExternalStore(subscribe, readAppearance, () => 'dark' as AppAppearance);
  return { appearance, toggleAppearance };
}
