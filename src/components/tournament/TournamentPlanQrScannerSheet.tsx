import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import {
  getQrCameraErrorMessage,
  QR_SCAN_UNSUPPORTED_MESSAGE,
  requestQrCameraStream,
  resolveQrScanBackend,
  startQrScanLoop,
  stopMediaStream,
} from '../../lib/tournamentPlanQrScanner';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (rawValue: string) => void;
  scanError: string | null;
  onScanError: (message: string | null) => void;
  saving?: boolean;
};

export const TournamentPlanQrScannerSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  onScanSuccess,
  scanError,
  onScanError,
  saving = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const savingRef = useRef(saving);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  savingRef.current = saving;

  const cleanupCamera = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (saving) return;
    cleanupCamera();
    onScanError(null);
    setCameraError(null);
    onClose();
  }, [cleanupCamera, onClose, onScanError, saving]);

  useEffect(() => {
    if (!isOpen) {
      cleanupCamera();
      setStarting(false);
      setCameraError(null);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setCameraError(null);
    onScanError(null);

    void (async () => {
      const resolvedBackend = await resolveQrScanBackend();
      if (cancelled) return;

      if (!resolvedBackend) {
        setCameraError(QR_SCAN_UNSUPPORTED_MESSAGE);
        setStarting(false);
        return;
      }

      try {
        const stream = await requestQrCameraStream();
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopMediaStream(stream);
          streamRef.current = null;
          setCameraError('Kamera-Vorschau konnte nicht gestartet werden.');
          setStarting(false);
          return;
        }

        video.srcObject = stream;
        await video.play();

        if (cancelled) return;

        stopScanRef.current = startQrScanLoop({
          video,
          backend: resolvedBackend,
          isCancelled: () => cancelled || savingRef.current,
          onDetect: (rawValue) => {
            if (cancelled || savingRef.current) return;
            onScanSuccess(rawValue);
          },
        });
        setStarting(false);
      } catch (error) {
        if (!cancelled) {
          setCameraError(getQrCameraErrorMessage(error));
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanupCamera();
    };
  }, [cleanupCamera, isOpen, onScanError, onScanSuccess]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const displayError = scanError ?? cameraError;

  return createPortal(
    <div
      className="modalOverlay !z-[1002]"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
      role="presentation"
    >
      <div
        className="modalSheet max-h-[min(92dvh,calc(100dvh-var(--app-header-h)-env(safe-area-inset-top,0px)-12px))] border border-purple-500/25 shadow-[0_0_40px_rgba(88,28,135,0.18)] sm:max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-qr-scanner-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="tournament-qr-scanner-title" className="modalTitle flex items-center gap-2 text-white">
            <ScanLine className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            QR-Code scannen
          </div>
          <button type="button" className="modalClose" onClick={handleClose} aria-label="Schließen" disabled={saving}>
            ×
          </button>
        </div>

        <div className="modalBody flex flex-col gap-3">
          <p className="text-[14px] text-white/70">QR-Code im Rahmen platzieren</p>

          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-black/80">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <div
              className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-purple-400/70 shadow-[inset_0_0_24px_rgba(168,85,247,0.12)]"
              aria-hidden
            />
            {starting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-white/80">
                Kamera wird gestartet…
              </div>
            ) : null}
          </div>

          {displayError ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {displayError}
            </p>
          ) : null}

          <AppButton variant="secondary" onClick={handleClose} disabled={saving} className="w-full">
            Abbrechen
          </AppButton>
        </div>
      </div>
    </div>,
    document.body,
  );
};
