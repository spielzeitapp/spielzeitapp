import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  const visible = Boolean(isOpen ?? open);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, handleKeyDown]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const handleOverlayClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
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
          {title && (
            <div id="modal-title" className={['modalTitle', titleClassName ?? ''].filter(Boolean).join(' ')}>
              {title}
            </div>
          )}
          <button
            type="button"
            className="modalClose"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="modalBody">
          {children}
        </div>

        {footer != null && (
          <div className="modalFooter">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
