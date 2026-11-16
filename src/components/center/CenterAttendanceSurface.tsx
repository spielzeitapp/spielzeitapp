import React from 'react';
import { Modal } from '../../app/ui/Modal';

export function CenterAttendanceSurface({ dialog, open, onClose, children, title='Verfügbarkeit klären', className }: { dialog: boolean; open: boolean; onClose: () => void; children: React.ReactNode;title?:string;className?:string }) {
  return dialog ? <Modal open={open} onClose={onClose} title={title} className={className}>{children}</Modal> : <>{children}</>;
}
