/** Call directly from a user gesture; never assumes access to the photo library. */
export async function savePhotoOnDevice(file: File): Promise<'shared'|'aborted'|'downloaded'> {
  const data: ShareData = { files: [file] };
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(data)) {
    try { await navigator.share(data); return 'shared'; }
    catch (error) { if ((error as {name?:string}).name === 'AbortError') return 'aborted'; throw error; }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000); }
  return 'downloaded';
}
