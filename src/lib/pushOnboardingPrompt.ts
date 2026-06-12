/** localStorage: Push-Onboarding-Hinweis pro User (keine DB-Migration). */

const STORAGE_PREFIX = 'spielzeit_push_prompt_v1_';
const REMIND_LATER_MS = 7 * 24 * 60 * 60 * 1000;

export type PushPromptStatus = 'remind_later' | 'activated';

type PushPromptRecord = {
  status: PushPromptStatus;
  at: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readRecord(userId: string): PushPromptRecord | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PushPromptRecord;
    if (!parsed?.status || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(userId: string, record: PushPromptRecord): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(record));
  } catch {
    /* privates Fenster / Speicher voll */
  }
}

/** true = Hinweis vorerst nicht anzeigen (aktiviert oder „Später“ innerhalb 7 Tage). */
export function shouldDeferPushOnboardingPrompt(userId: string | undefined | null): boolean {
  if (!userId) return true;
  const record = readRecord(userId);
  if (!record) return false;
  if (record.status === 'activated') return true;
  if (record.status === 'remind_later') {
    const at = Date.parse(record.at);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < REMIND_LATER_MS;
  }
  return false;
}

export function markPushOnboardingRemindLater(userId: string): void {
  writeRecord(userId, { status: 'remind_later', at: new Date().toISOString() });
}

export function markPushOnboardingActivated(userId: string): void {
  writeRecord(userId, { status: 'activated', at: new Date().toISOString() });
}
