import { Upload } from 'tus-js-client';
import { supabase } from './supabaseClient';

const STALL_MS = 90_000;
const MAX_DURATION_MS = 15 * 60_000;

export function feedStorageEndpoint(url: string): string {
  const endpoint = new URL(url);
  if (endpoint.hostname.endsWith('.supabase.co') && !endpoint.hostname.endsWith('.storage.supabase.co')) {
    endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  }
  endpoint.pathname = '/storage/v1/upload/resumable';
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.toString();
}

/** Chunked feed uploads. The server validates the session token and existing RLS. */
export function uploadFeedMedia(
  file: File,
  objectPath: string,
  options: { signal: AbortSignal; onProgress: (percent: number) => void },
): Promise<void> {
  return new Promise((resolve, reject) => {
    let upload: Upload | undefined;
    let settled = false;
    let stallTimer: ReturnType<typeof setTimeout>;
    let overallTimer: ReturnType<typeof setTimeout>;
    let lastBytes = -1;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(stallTimer);
      clearTimeout(overallTimer);
      options.signal.removeEventListener('abort', cancel);
      if (error) {
        // Do not terminate/delete server data: cancellation must not require extra permissions.
        void upload?.abort().catch(() => undefined);
        reject(error);
      } else resolve();
    };
    const cancel = () => finish(new Error('Upload abgebrochen. Video und Caption bleiben ausgewählt.'));
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => finish(new Error(
        'Seit 90 Sekunden kein Upload-Fortschritt. Bitte Verbindung prüfen und erneut versuchen. Video und Caption bleiben erhalten.',
      )), STALL_MS);
    };
    if (options.signal.aborted) { cancel(); return; }
    options.signal.addEventListener('abort', cancel, { once: true });
    resetStallTimer();
    overallTimer = setTimeout(() => finish(new Error('Upload dauert zu lange. Bitte Verbindung prüfen und erneut versuchen.')), MAX_DURATION_MS);

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (settled) return;
      if (error || !data.session?.access_token) throw new Error('Bitte neu anmelden und erneut versuchen.');
      upload = new Upload(file, {
        endpoint: feedStorageEndpoint(import.meta.env.VITE_SUPABASE_URL as string),
        headers: { authorization: `Bearer ${data.session.access_token}`, 'x-upsert': 'false' },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        // Avoid cross-team/path resumption from browser localStorage.
        storeFingerprintForResuming: false,
        metadata: { bucketName: 'team-feed', objectName: objectPath, contentType: file.type, cacheControl: '3600' },
        onProgress: (sent, total) => {
          if (settled) return;
          if (sent > lastBytes) { lastBytes = sent; resetStallTimer(); }
          options.onProgress(total ? Math.min(100, Math.floor(sent / total * 100)) : 0);
        },
        onError: (error) => finish(new Error(`Video-Upload fehlgeschlagen: ${error.message}`)),
        onSuccess: () => finish(),
      });
      upload.start();
    })().catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))));
  });
}
