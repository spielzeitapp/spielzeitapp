import { toBlob } from 'html-to-image';

/** Wartet auf img load/error, damit Logos im PNG sichtbar sind. */
export async function waitForPosterImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

/**
 * Rendert das sichtbare MatchdayPosterCard-Root (HTMLElement) als PNG-Blob.
 * Reine Client-Logik — kein Storage.
 */
export async function matchdayPosterDomToPngBlob(root: HTMLElement): Promise<Blob | null> {
  try {
    await waitForPosterImages(root);
    const blob = await toBlob(root, {
      pixelRatio: Math.min(2.5, Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)),
      cacheBust: true,
      backgroundColor: '#140808',
    });
    return blob;
  } catch (e) {
    console.warn('[matchdayPosterExport] PNG export failed', e);
    return null;
  }
}
