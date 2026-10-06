import { matchdayPosterDomToPngBlob } from './matchdayPosterExport';

export async function prepareWhatsAppStatusFile(root: HTMLElement): Promise<File | null> {
  const video = root.querySelector<HTMLVideoElement>('[data-whatsapp-status-video]');
  const videoSrc = video?.currentSrc || video?.src;
  if (videoSrc) {
    const response = await fetch(videoSrc);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('video/') || blob.size < 64) return null;
    const ext = blob.type === 'video/webm' ? 'webm' : blob.type === 'video/quicktime' ? 'mov' : 'mp4';
    return new File([blob], `spielzeit-status.${ext}`, { type: blob.type });
  }
  const image = root.querySelector<HTMLImageElement>('[data-whatsapp-status-image]');
  if (image?.src) {
    const response = await fetch(image.src);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size < 64) return null;
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `spielzeit-status.${ext}`, { type: blob.type });
  }
  const poster = root.querySelector<HTMLElement>('[data-whatsapp-status-poster]');
  if (!poster) return null;
  const blob = await matchdayPosterDomToPngBlob(poster);
  return blob && blob.size > 64 ? new File([blob], 'spielzeit-status.png', { type: 'image/png' }) : null;
}

/** Nur die Bild-/Videodatei: keine Caption, kein technischer Link und kein automatisches Senden. */
export async function shareWhatsAppStatusFile(file: File): Promise<'shared' | 'aborted' | 'downloaded'> {
  const data: ShareData = { files: [file] };
  try {
    if (typeof navigator.share === 'function' &&
        (typeof navigator.canShare !== 'function' || navigator.canShare(data))) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'aborted';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
