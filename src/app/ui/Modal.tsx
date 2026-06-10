import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../lib/bodyScrollLock';

interface ModalProps {
  /** Bevorzugter Prop-Name (Alias: `open`). */
  isOpen?: boolean;
  open?: boolean;
  title?: string;
  /** Zusätzliche Klassen für den Titel (z. B. größere Typo im Match-Editor). */
  titleClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Sticky footer (e.g. Abbrechen / Speichern). Buttons bleiben sichtbar. */
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  open,
  title,
  titleClassName,
  onClose,
  children,
  footer,
}) => {
  const effectiveOpen = isOpen ?? open ?? false;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!effectiveOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [effectiveOpen, handleKeyDown]);

  useEffect(() => {
    if (!effectiveOpen) return;
    return lockBodyScroll();
  }, [effectiveOpen]);

  if (!effectiveOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleOverlayClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modal = (
    <div
      className="modalOverlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="modalSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          {title ? (
            <div id="modal-title" className={['modalTitle', titleClassName ?? ''].filter(Boolean).join(' ')}>
              {title}
            </div>
          ) : null}
          <button
            type="button"
            className="modalClose"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer != null ? <div className="modalFooter">{footer}</div> : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
