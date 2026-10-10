import React from 'react';
import { CalendarDays, ClipboardList, Dumbbell, Monitor, Users } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';

const features = [
  { Icon: ClipboardList, title: 'Trainingsplanung', text: 'Einheiten vorbereiten und Trainingspläne zusammenstellen.' },
  { Icon: Dumbbell, title: 'Übungsbibliothek', text: 'Passende Übungen finden und für das Training auswählen.' },
  { Icon: CalendarDays, title: 'Platzbelegung', text: 'Trainings und Spiele am Sportplatz übersichtlich koordinieren.' },
  { Icon: Users, title: 'Saisonverwaltung', text: 'Mannschaften, Kader und die nächste Saison vorbereiten.' },
];

export function DemoManagerPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="SpielzeitManager"
      className="!max-w-lg !border-red-500/25 !bg-neutral-950 !text-white"
      footer={<button type="button" onClick={onClose} className={`${dsPrimaryCtaClass()} w-full`}>Zurück zur App-Demo</button>}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/50 to-black p-4">
          <Monitor className="mb-3 h-7 w-7 text-red-400" aria-hidden />
          <h2 className="text-xl font-extrabold">Planung am Desktop</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">Bereite euren Mannschaftsalltag am großen Bildschirm vor. Mit der SpielzeitApp hat das Team die Informationen am Handy dabei.</p>
        </div>
        <ul className="space-y-4">
          {features.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
              <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p></div>
            </li>
          ))}
        </ul>
        <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">Die Manager-Demo folgt. Hier siehst du bereits, welche Bereiche der SpielzeitManager bietet.</p>
      </div>
    </Modal>
  );
}
