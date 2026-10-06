export type FeedShareOutcome = 'shared' | 'copied' | 'aborted' | 'failed';

/**
 * Datei + Text (wenn möglich), sonst Text / Zwischenablage.
 * fetchUrl ist ausschließlich eine interne Download-URL, niemals ein Share-Link.
 */
export async function shareFeedContent(opts: {
  title: string;
  text: string;
  /** Bereits signierte oder öffentliche URL zum Abrufen der Datei (optional). */
  fetchUrl?: string | null;
  /** Bereits im Browser erzeugte Grafik für den Datei-Share. */
  file?: File | null;
  fileName?: string;
  mimeType?: string;
}): Promise<FeedShareOutcome> {
  const { title, text, fetchUrl, fileName = 'spielzeit-share.bin', mimeType } = opts;

  let file: File | null = opts.file ?? null;
  if (!file && fetchUrl) {
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
    const candidates: ShareData[] = [];
    if (typeof navigator.canShare === 'function') {
      if (navigator.canShare(withFile)) candidates.push(withFile);
    }
    if (candidates.length === 0) candidates.push(withFile);
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
    const candidates: ShareData[] = [{ title, text }];
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
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
