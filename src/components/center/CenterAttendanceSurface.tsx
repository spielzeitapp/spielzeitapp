import React from 'react';
import { Modal } from '../../app/ui/Modal';

export function CenterAttendanceSurface({ dialog, open, onClose, children }: { dialog: boolean; open: boolean; onClose: () => void; children: React.ReactNode }) {
  return dialog ? <Modal open={open} onClose={onClose} title="Verfügbarkeit klären">{children}</Modal> : <>{children}</>;
}
