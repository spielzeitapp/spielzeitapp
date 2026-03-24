/** Gleicher Key wie MessagesPage / MessageDetailPage (Client-only „gelesen“). */
export const MESSAGES_READ_STORAGE_KEY = 'spz_read_messages';

export const MESSAGES_READ_CHANGED_EVENT = 'spz_messages_read_changed';

export function readReadSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(MESSAGES_READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function writeReadSet(set: Set<string>): void {
  try {
    window.localStorage.setItem(MESSAGES_READ_STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event(MESSAGES_READ_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function notifyMessagesReadChanged(): void {
  try {
    window.dispatchEvent(new Event(MESSAGES_READ_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Ungelesen: nur DB-Feld read (kein true). */
export function countUnreadMessages(
  rows: Array<{ id: string; read?: boolean | null }>,
  _readSet?: Set<string>,
): number {
  let c = 0;
  for (const m of rows) {
    if (m.read !== true) c += 1;
  }
  return c;
}
