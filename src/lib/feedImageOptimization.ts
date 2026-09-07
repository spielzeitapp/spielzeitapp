const MAX_FEED_IMAGE_WIDTH = 1440;
const MAX_FEED_IMAGE_HEIGHT = 1800;
const FEED_IMAGE_QUALITY = 0.84;

function optimizedDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_FEED_IMAGE_WIDTH / width, MAX_FEED_IMAGE_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Verkleinert große Feed-Fotos vor dem Upload; bei Browser-Problemen bleibt das Original. */
export async function optimizeFeedImageForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = optimizedDimensions(bitmap.width, bitmap.height);
    const shouldResize = size.width !== bitmap.width || size.height !== bitmap.height;
    if (!shouldResize && file.type === 'image/webp' && file.size <= 1_500_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      bitmap.close();
      return file;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', FEED_IMAGE_QUALITY);
    });
    if (!blob || blob.size <= 0 || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'feed-bild';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
