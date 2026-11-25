import { createWorker, OEM, PSM } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import languagePath from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url';
import { tournamentLivestreamLinksInText } from './tournamentLivestreamLinkText.mjs';

async function prepareImage(file: File, signal: AbortSignal): Promise<HTMLCanvasElement> {
  const image = new Image();
  const source = URL.createObjectURL(file);
  try {
    image.src = source;
    await image.decode();
    signal.throwIfAborted();
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bildverarbeitung ist nicht verfügbar.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function scanTournamentLivestreamPhoto(file: File, signal: AbortSignal): Promise<string[]> {
  const image = await prepareImage(file, signal);
  const langPath = new URL('.', new URL(languagePath, window.location.href)).href;
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath,
    corePath,
    langPath,
    workerBlobURL: false,
    cacheMethod: 'none',
    errorHandler: () => {},
  });
  let termination: ReturnType<typeof worker.terminate> | undefined;
  const terminate = () => { termination ??= worker.terminate(); };
  signal.addEventListener('abort', terminate, { once: true });
  try {
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const result = await worker.recognize(image);
    return tournamentLivestreamLinksInText(result.data.text);
  } finally {
    signal.removeEventListener('abort', terminate);
    terminate();
    await termination;
  }
}
