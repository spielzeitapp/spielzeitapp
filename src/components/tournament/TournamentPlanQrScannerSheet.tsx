import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import { isRecognizedTournamentPlanHost } from '../../lib/tournamentPlanImport';
import { validateOfficialTournamentUrl } from '../../lib/tournamentOfficialPlanUrl';
import {
  getQrCameraErrorMessage,
  INVALID_QR_TOURNAMENT_LINK_HINT,
  INVALID_QR_TOURNAMENT_LINK_MESSAGE,
  QR_CAMERA_UNAVAILABLE_TITLE,
  QR_SCAN_HINT_PRIMARY,
  QR_SCAN_HINT_SECONDARY,
  QR_SCAN_UNSUPPORTED_MESSAGE,
  requestQrCameraStream,
  resolveQrScanBackend,
  startQrScanLoop,
  stopMediaStream,
  type QrScanPhase,
} from '../../lib/tournamentPlanQrScanner';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Nur bei gültigem unterstütztem Turnier-Link. */
  onScanSuccess: (rawValue: string) => void;
  onEnterLink?: () => void;
  /** Parent speichert / analysiert — Scan pausieren, Kamera bleibt an. */
  saving?: boolean;
  /** Speichern/Import fehlgeschlagen — Scanner bleibt offen. */
  saveError?: string | null;
};

const UNSUPPORTED_RESUME_MS = 2200;

export const TournamentPlanQrScannerSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onEnterLink,
  saving = false,
  saveError = null,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef<QrScanPhase>('idle');
  const stoppedRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const resumeTimerRef = useRef<number | null>(null);
  const savingRef = useRef(saving);

  const [phase, setPhase] = useState<QrScanPhase>('idle');
  const [statusLine, setStatusLine] = useState(QR_SCAN_HINT_PRIMARY);
  const [retryToken, setRetryToken] = useState(0);

  onScanSuccessRef.current = onScanSuccess;
  onCloseRef.current = onClose;
  phaseRef.current = phase;
  savingRef.current = saving;

  const setPhaseSafe = useCallback((next: QrScanPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const cleanupCamera = useCallback(() => {
    clearResumeTimer();
    stopScanRef.current?.();
    stopScanRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, [clearResumeTimer]);

  const handleClose = useCallback(() => {
    if (savingRef.current) return;
    stoppedRef.current = true;
    cleanupCamera();
    setPhaseSafe('idle');
    setStatusLine(QR_SCAN_HINT_PRIMARY);
    onCloseRef.current();
  }, [cleanupCamera, setPhaseSafe]);

  const handleDetected = useCallback(
    (rawValue: string) => {
      if (stoppedRef.current) return;
      if (phaseRef.current !== 'scanning') return;
      if (savingRef.current) return;

      setPhaseSafe('validating');
      setStatusLine('QR-Code erkannt ✓');

      const validated = validateOfficialTournamentUrl(rawValue);
      if (!validated.ok || !isRecognizedTournamentPlanHost(validated.url)) {
        setPhaseSafe('unsupported');
        setStatusLine(INVALID_QR_TOURNAMENT_LINK_MESSAGE);
        clearResumeTimer();
        resumeTimerRef.current = window.setTimeout(() => {
          if (stoppedRef.current || savingRef.current) return;
          if (phaseRef.current !== 'unsupported') return;
          setPhaseSafe('scanning');
          setStatusLine(QR_SCAN_HINT_PRIMARY);
        }, UNSUPPORTED_RESUME_MS);
        return;
      }

      // Kamera bleibt aktiv bis Parent schließt (Erfolg) oder Speichern fehlschlägt.
      setPhaseSafe('success');
      setStatusLine('QR-Code erkannt ✓');
      onScanSuccessRef.current(validated.url);
    },
    [clearResumeTimer, setPhaseSafe],
  );

  // Speichern beendet mit Fehler → wieder scannen (Kamera bleibt an).
  useEffect(() => {
    if (!isOpen) return;
    if (saving) {
      setStatusLine('QR-Code erkannt ✓');
      return;
    }
    if (saveError) {
      setPhaseSafe('scanning');
      setStatusLine(saveError);
    }
  }, [isOpen, saving, saveError, setPhaseSafe]);

  useEffect(() => {
    if (!isOpen) {
      stoppedRef.current = true;
      cleanupCamera();
      setPhaseSafe('idle');
      setStatusLine(QR_SCAN_HINT_PRIMARY);
      return;
    }

    let cancelled = false;
    stoppedRef.current = false;
    setPhaseSafe('starting');
    setStatusLine(QR_SCAN_HINT_PRIMARY);

    void (async () => {
      const resolvedBackend = await resolveQrScanBackend();
      if (cancelled || stoppedRef.current) return;

      if (!resolvedBackend) {
        setPhaseSafe('camera_error');
        setStatusLine(QR_SCAN_UNSUPPORTED_MESSAGE);
        return;
      }

      try {
        const stream = await requestQrCameraStream();
        if (cancelled || stoppedRef.current) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;

        let video = videoRef.current;
        if (!video) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
          video = videoRef.current;
        }
        if (!video) {
          stopMediaStream(stream);
          streamRef.current = null;
          setPhaseSafe('camera_error');
          setStatusLine(QR_CAMERA_UNAVAILABLE_TITLE);
          return;
        }

        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;

        try {
          await video.play();
        } catch {
          /* iOS: play() kann kurz scheitern — Stream bleibt aktiv */
        }

        if (cancelled || stoppedRef.current) return;

        stopScanRef.current = startQrScanLoop({
          video,
          backend: resolvedBackend,
          isStopped: () => cancelled || stoppedRef.current,
          isPaused: () => {
            if (savingRef.current) return true;
            const p = phaseRef.current;
            return p !== 'scanning';
          },
          onDetect: handleDetected,
        });

        setPhaseSafe('scanning');
        setStatusLine(QR_SCAN_HINT_PRIMARY);
      } catch (error) {
        if (!cancelled && !stoppedRef.current) {
          setPhaseSafe('camera_error');
          setStatusLine(getQrCameraErrorMessage(error));
        }
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      cleanupCamera();
    };
    // Parent-Callbacks absichtlich nicht in deps (Kamera-Restart vermeiden).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOpen/retryToken steuern Neustart
  }, [isOpen, retryToken, cleanupCamera, handleDetected, setPhaseSafe]);

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
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

  const showCameraError = phase === 'camera_error';
  const showUnsupported = phase === 'unsupported';
  const busyClose = saving;

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
          <button
            type="button"
            className="modalClose"
            onClick={handleClose}
            aria-label="Schließen"
            disabled={busyClose}
          >
            ×
          </button>
        </div>

        <div className="modalBody flex flex-col gap-3">
          <div>
            <p className="text-[14px] text-white/70" role="status" aria-live="polite">
              {statusLine}
            </p>
            {phase === 'scanning' || phase === 'starting' ? (
              <p className="mt-1 text-[11px] text-white/40">{QR_SCAN_HINT_SECONDARY}</p>
            ) : null}
            {showUnsupported ? (
              <p className="mt-1 text-[12px] text-white/55">{INVALID_QR_TOURNAMENT_LINK_HINT}</p>
            ) : null}
          </div>

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
            {phase === 'starting' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-white/80">
                Kamera wird gestartet…
              </div>
            ) : null}
            {(phase === 'validating' || phase === 'success' || saving) && !showCameraError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-semibold text-emerald-200">
                QR-Code erkannt ✓
              </div>
            ) : null}
          </div>

          {showCameraError ? (
            <div className="flex flex-col gap-2" role="alert">
              <p className="text-[15px] font-semibold text-white">{QR_CAMERA_UNAVAILABLE_TITLE}</p>
              <p className="text-[12px] text-white/55">
                Bitte Kamerazugriff in den Einstellungen erlauben oder den Link manuell eingeben.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <AppButton
                  variant="primary"
                  className="w-full"
                  disabled={busyClose}
                  onClick={() => {
                    setStatusLine(QR_SCAN_HINT_PRIMARY);
                    setRetryToken((n) => n + 1);
                  }}
                >
                  Kamera erneut versuchen
                </AppButton>
                {onEnterLink ? (
                  <AppButton
                    variant="secondary"
                    className="w-full"
                    disabled={busyClose}
                    onClick={() => {
                      handleClose();
                      onEnterLink();
                    }}
                  >
                    Link manuell eingeben
                  </AppButton>
                ) : null}
              </div>
            </div>
          ) : null}

          <AppButton variant="secondary" onClick={handleClose} disabled={busyClose} className="w-full">
            Abbrechen
          </AppButton>
        </div>
      </div>
    </div>,
    document.body,
  );
};
