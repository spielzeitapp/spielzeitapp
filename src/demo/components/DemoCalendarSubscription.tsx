import React, { useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import { Button } from '../../app/components/ui/Button';

const guides = {
  'iPhone Kalender': 'In der App öffnest du über diese Auswahl den Teamkalender und bestätigst das Kalender-Abo am iPhone.',
  'Google Kalender': 'In der App kopierst du die Abo-URL. In Google Kalender wählst du „Weitere Kalender“ → „Per URL“ und fügst sie ein.',
  FamilyWall: 'In der App kopierst du die Abo-URL und fügst sie in FamilyWall als externen ICS-Kalender hinzu.',
};

/** Preview only: never use a real club calendar URL from the signed-in session. */
export function DemoCalendarSubscription({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<keyof typeof guides | null>(null);
  const close = () => { setSelected(null); onClose(); };
  return (
    <Modal isOpen={open} title="Kalender abonnieren" onClose={close}
      footer={<Button variant="ghost" onClick={close}>Schließen</Button>}>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-white/70">Spiele und Trainings im eigenen Handy- oder Familienkalender. Ein Kalender-Abo übernimmt Terminänderungen bei der nächsten Aktualisierung des Kalenders.</p>
        {Object.keys(guides).map((name) => (
          <button key={name} type="button" onClick={() => setSelected(name as keyof typeof guides)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left font-semibold text-white">
            {name}<span aria-hidden>›</span>
          </button>
        ))}
        {selected && <div role="status" className="rounded-xl border border-red-400/30 bg-red-950/25 p-4 text-sm text-white/85"><strong>{selected}</strong><p className="mt-2">{guides[selected]}</p></div>}
        <p className="text-xs text-white/55">Demo-Vorschau: Hier wird kein Kalender-Abo eingerichtet.</p>
      </div>
    </Modal>
  );
}
