export type FeedShareOutcome = 'shared' | 'copied' | 'aborted' | 'failed';

/**
 * Web Share API mit Datei (wenn möglich), sonst Text+URL, sonst Zwischenablage.
 */
export async function shareFeedContent(opts: {
  title: string;
  text: string;
  /** Bereits signierte oder öffentliche URL zum Abrufen der Datei (optional). */
  fetchUrl?: string | null;
  fileName?: string;
  mimeType?: string;
}): Promise<FeedShareOutcome> {
  const { title, text, fetchUrl, fileName = 'spielzeit-share.bin', mimeType } = opts;

  let file: File | null = null;
  if (fetchUrl) {
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const blob = await res.blob();
        const type = mimeType || blob.type || 'application/octet-stream';
        if (blob.size > 64) {
          file = new File([blob], fileName, { type });
        }
      }
    } catch {
      file = null;
    }
  }

  const tryShareWithFile = async (): Promise<boolean> => {
    if (!file || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const withFile: ShareData = { files: [file], title, text };
    const withAll: ShareData = { files: [file], title, text, url: fetchUrl ?? undefined };
    const candidates: ShareData[] = [];
    if (typeof navigator.canShare === 'function') {
      if (navigator.canShare(withAll)) candidates.push(withAll);
      if (navigator.canShare(withFile)) candidates.push(withFile);
    }
    if (candidates.length === 0) candidates.push(withAll, withFile);
    for (const data of candidates) {
      try {
        await navigator.share(data);
        return true;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
      }
    }
    return false;
  };

  const tryShareText = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const textAndLink = fetchUrl ? `${text}\n${fetchUrl}` : text;
    const candidates: ShareData[] = [{ title, text: textAndLink }];
    if (fetchUrl) candidates.unshift({ title, text, url: fetchUrl });
    for (const data of candidates) {
      try {
        if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) continue;
        await navigator.share(data);
        return true;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
      }
    }
    return false;
  };

  try {
    if (await tryShareWithFile()) return 'shared';
  } catch {
    return 'aborted';
  }
  try {
    if (await tryShareText()) return 'shared';
  } catch {
    return 'aborted';
  }
  try {
    const clip = fetchUrl ? `${text}\n${fetchUrl}` : text;
    await navigator.clipboard.writeText(clip);
    return 'copied';
  } catch {
    return 'failed';
  }
}
