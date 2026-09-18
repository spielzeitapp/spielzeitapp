const MAX_POSTER_EDGE = 1600;
const POSTER_WEBP_QUALITY = 0.84;

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', POSTER_WEBP_QUALITY));
}

/** Verkleinert große Feedposter vor dem Upload; bei Browserproblemen bleibt die Originaldatei erhalten. */
export async function optimizeFeedPosterFile(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_POSTER_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      bitmap.close();
      return file;
    }
    context.fillStyle = '#08080a';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const optimized = await canvasToWebp(canvas);
    if (!optimized || optimized.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'spielzeit-poster';
    return new File([optimized], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
