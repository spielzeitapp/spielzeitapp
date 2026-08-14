export type QrScanBackend = 'barcode-detector' | 'jsqr';

export type QrScanPhase =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'validating'
  | 'success'
  | 'unsupported'
  | 'camera_error';

export const QR_SCAN_UNSUPPORTED_MESSAGE =
  'QR-Scan wird auf diesem Gerät nicht unterstützt. Bitte Link manuell eingeben.';

export const INVALID_QR_TOURNAMENT_LINK_MESSAGE =
  'Dieser QR-Code enthält keinen unterstützten Turnierplan.';

export const INVALID_QR_TOURNAMENT_LINK_HINT = 'Bitte einen anderen QR-Code scannen.';

export const QR_SCAN_HINT_PRIMARY = 'QR-Code im Rahmen platzieren';
export const QR_SCAN_HINT_SECONDARY = 'Scanner bleibt geöffnet, bis ein QR-Code erkannt wurde.';

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export async function resolveQrScanBackend(): Promise<QrScanBackend | null> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorCtor = window.BarcodeDetector as typeof BarcodeDetector;
      const formats = await BarcodeDetectorCtor.getSupportedFormats();
      if (formats.includes('qr_code')) {
        return 'barcode-detector';
      }
    } catch {
      /* fallback below */
    }
  }

  try {
    await import('jsqr');
    return 'jsqr';
  } catch {
    return null;
  }
}

export async function requestQrCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(QR_SCAN_UNSUPPORTED_MESSAGE);
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

export const QR_CAMERA_UNAVAILABLE_TITLE = 'Kamera-Zugriff nicht möglich';

export function getQrCameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return QR_CAMERA_UNAVAILABLE_TITLE;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return QR_CAMERA_UNAVAILABLE_TITLE;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return QR_CAMERA_UNAVAILABLE_TITLE;
  }
  if (error instanceof Error && error.message === QR_SCAN_UNSUPPORTED_MESSAGE) {
    return QR_CAMERA_UNAVAILABLE_TITLE;
  }
  return QR_CAMERA_UNAVAILABLE_TITLE;
}

type ScanLoopOptions = {
  video: HTMLVideoElement;
  backend: QrScanBackend;
  onDetect: (rawValue: string) => void;
  /** Permanenter Stop (Unmount / Modal zu). */
  isStopped: () => boolean;
  /** Temporär keine Callbacks (validating / success) — Loop läuft weiter. */
  isPaused: () => boolean;
};

/**
 * Kontinuierlicher Scan-Loop bis `stop()` oder `isStopped()`.
 * Erfolglose Frames und pausierte Phasen beenden die Kamera NICHT.
 */
export function startQrScanLoop(options: ScanLoopOptions): () => void {
  const { video, backend, onDetect, isStopped, isPaused } = options;
  let rafId = 0;
  let detector: BarcodeDetector | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let canvasCtx: CanvasRenderingContext2D | null = null;
  let jsQrModule: typeof import('jsqr') | null = null;
  let lastEmitted = '';
  let lastEmitAt = 0;

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const emitIfFresh = (raw: string) => {
    if (isStopped() || isPaused()) return;
    const now = Date.now();
    // Gleicher Code nicht im Burst erneut liefern (Doppelscan-Schutz im Loop).
    if (raw === lastEmitted && now - lastEmitAt < 1500) return;
    lastEmitted = raw;
    lastEmitAt = now;
    onDetect(raw);
  };

  void (async () => {
    if (backend === 'barcode-detector') {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
      const scan = async () => {
        if (isStopped()) return;
        try {
          if (!isPaused() && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            const codes = await detector!.detect(video);
            const raw = codes[0]?.rawValue?.trim();
            if (raw) emitIfFresh(raw);
          }
        } catch {
          /* frame read errors are ok — keep looping */
        }
        if (!isStopped()) {
          rafId = requestAnimationFrame(() => void scan());
        }
      };
      rafId = requestAnimationFrame(() => void scan());
      return;
    }

    jsQrModule = await import('jsqr');
    if (isStopped()) return;
    canvas = document.createElement('canvas');
    canvasCtx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (isStopped()) return;
      try {
        if (
          !isPaused() &&
          video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
          canvas &&
          canvasCtx &&
          jsQrModule
        ) {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            canvasCtx.drawImage(video, 0, 0, w, h);
            const imageData = canvasCtx.getImageData(0, 0, w, h);
            const code = jsQrModule.default(imageData.data, imageData.width, imageData.height);
            const raw = code?.data?.trim();
            if (raw) emitIfFresh(raw);
          }
        }
      } catch {
        /* keep looping */
      }
      if (!isStopped()) {
        rafId = requestAnimationFrame(scan);
      }
    };
    rafId = requestAnimationFrame(scan);
  })();

  return stop;
}
