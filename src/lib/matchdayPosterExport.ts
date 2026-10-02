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
export async function matchdayPosterDomToPngBlob(root: HTMLElement, outputWidth?: number): Promise<Blob | null> {
  try {
    await waitForPosterImages(root);
    await document.fonts.ready;
    const bounds = root.getBoundingClientRect();
    const output = outputWidth && bounds.width > 0 && bounds.height > 0
      ? { canvasWidth: outputWidth, canvasHeight: Math.round(outputWidth * bounds.height / bounds.width), pixelRatio: 1 }
      : { pixelRatio: Math.min(2.5, Math.max(2, window.devicePixelRatio || 2)) };
    const blob = await toBlob(root, {
      ...output,
      cacheBust: true,
      backgroundColor: '#140808',
    });
    return blob;
  } catch (e) {
    console.warn('[matchdayPosterExport] PNG export failed', e);
    return null;
  }
}
