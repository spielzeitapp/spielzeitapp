import {playerPhotoDisplayUrl} from './playerPhotoDisplay';

/** On-device portrait segmentation. Only model/runtime assets are downloaded;
 * the photograph is never uploaded to an external inference service. */
export async function removePortraitBackground(source: string): Promise<Blob> {
  if (!source.trim()) throw new Error('Bitte zuerst ein Spielerfoto hochladen.');
  const response = await fetch(playerPhotoDisplayUrl(source), {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Das Originalfoto konnte nicht geladen werden.');
  const file = await response.blob();
  if (file.size > 20 * 1024 * 1024) throw new Error('Das Foto ist zu groß. Bitte ein Bild unter 20 MB verwenden.');
  const objectUrl = URL.createObjectURL(file);
  let segmenter: import('@mediapipe/tasks-vision').ImageSegmenter | undefined;
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Bildverarbeitung ist in diesem Browser nicht verfügbar.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const {FilesetResolver, ImageSegmenter} = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm');
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite', delegate: 'CPU'},
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    segmenter.segment(canvas, result => {
      const masks = result.confidenceMasks;
      if (!masks?.length) throw new Error('Keine Person erkannt. Bitte ein anderes Portraitfoto versuchen.');
      // The pinned selfie model emits one foreground-confidence mask.
      const mask = masks[0];
      const confidence = mask.getAsFloat32Array();
      const matte = document.createElement('canvas');
      matte.width = mask.width; matte.height = mask.height;
      const mctx = matte.getContext('2d');
      if (!mctx) throw new Error('Freistellung konnte nicht erstellt werden.');
      const pixels = mctx.createImageData(mask.width, mask.height);
      let foreground = 0, background = 0;
      for (let i = 0; i < confidence.length; i++) {
        const t = Math.max(0, Math.min(1, (confidence[i] - 0.2) / 0.6));
        pixels.data[i*4+3] = Math.round(255 * t * t * (3-2*t));
        if (t > 0.5) foreground++;
        if (t < 0.5) background++;
      }
      if (foreground < confidence.length * 0.01 || background < confidence.length * 0.01) {
        throw new Error('Person und Hintergrund konnten nicht klar getrennt werden. Bitte ein anderes Foto versuchen.');
      }
      mctx.putImageData(pixels, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(matte, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG konnte nicht erstellt werden.')), 'image/png'));
  } finally {
    segmenter?.close();
    URL.revokeObjectURL(objectUrl);
  }
}
