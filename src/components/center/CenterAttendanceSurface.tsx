import React from 'react';
import { Modal } from '../../app/ui/Modal';

export function CenterAttendanceSurface({ dialog, open, onClose, children, title='Verfügbarkeit klären', className, footer }: { dialog: boolean; open: boolean; onClose: () => void; children: React.ReactNode;title?:string;className?:string;footer?:React.ReactNode }) {
  return dialog ? <Modal open={open} onClose={onClose} title={title} className={className} footer={footer}>{children}</Modal> : <>{children}</>;
}
