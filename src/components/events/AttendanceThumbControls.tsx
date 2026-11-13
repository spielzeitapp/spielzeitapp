import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, UserX, Thermometer, Bandage, CircleDot, Users } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import type { TrainingAttendanceStatus } from '../../lib/trainingAttendance';

export function AttendanceThumbControls({ name, status, isLaz, allowOtherTeam = false, onSelect, disabled = false }: {
  name: string; status: TrainingAttendanceStatus; isLaz?: boolean; allowOtherTeam?: boolean;
  onSelect: (status: TrainingAttendanceStatus, note?: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [otherTeam, setOtherTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const unavailable = ['absent', 'sick', 'injured', 'external', 'other_team'].includes(status);
  const choices = [
    { status: 'absent' as const, label: 'Abwesend', icon: UserX, color: 'text-rose-300' },
    { status: 'sick' as const, label: 'Krank', icon: Thermometer, color: 'text-blue-300' },
    { status: 'injured' as const, label: 'Verletzt', icon: Bandage, color: 'text-orange-300' },
    ...(allowOtherTeam ? [{ status: 'other_team' as const, label: 'Andere Mannschaft', icon: Users, color: 'text-violet-300' }] : []),
    ...(isLaz || status === 'external' ? [{ status: 'external' as const, label: 'LAZ', icon: CircleDot, color: 'text-teal-300' }] : []),
  ];
  const base = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40';
  return <>
    <div className="flex shrink-0 gap-1">
      <button type="button" disabled={disabled} aria-label={`${name}: Dabei`} aria-pressed={status === 'present'} className={`${base} ${status === 'present' ? 'bg-emerald-900/70 text-emerald-300' : 'bg-white/[0.045] text-white/45'}`} onClick={() => onSelect('present')}><ThumbsUp className="h-5 w-5" aria-hidden /></button>
      <button type="button" disabled={disabled} aria-label={`${name}: Grund für Abwesenheit wählen`} aria-haspopup="dialog" aria-pressed={unavailable} className={`${base} ${unavailable ? 'bg-red-950/80 text-rose-300' : 'bg-white/[0.045] text-white/45'}`} onClick={() => { setOtherTeam(false); setOpen(true); }}><ThumbsDown className="h-5 w-5" aria-hidden /></button>
    </div>
    <Modal open={open && !disabled} onClose={() => setOpen(false)} title="Nicht dabei">
      <p className="mb-4 text-[17px] text-white/70">{name} · Status wählen</p>
      {otherTeam ? <div className="space-y-3"><label className="block text-[16px]">Mannschaft<input autoFocus maxLength={80} placeholder="z. B. U13 · Fahrgemeinschaft" value={teamName} onChange={e => setTeamName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-black/40 px-3 text-white" /></label><p className="text-[14px] text-white/65">Beim eigenen Team abwesend · Trainingseinheit wird angerechnet.</p><button type="button" disabled={!teamName.trim()} className="sz-club-event-action min-h-12 w-full rounded-full border font-bold disabled:opacity-40" onClick={() => { onSelect('other_team', teamName.trim()); setOpen(false); }}>Training bei anderer Mannschaft speichern</button></div> : <div className="grid grid-cols-2 gap-2">
        {choices.map(({ status: choice, label, icon: Icon, color }) => <button key={choice} type="button" aria-pressed={status === choice} onClick={() => { if (choice === 'other_team') { setOtherTeam(true); return; } setOpen(false); onSelect(choice); }} className="sz-club-event-action flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-[18px] font-bold text-white"><Icon className={`h-7 w-7 ${color}`} aria-hidden />{label}</button>)}
      </div>}
      <p className="mt-4 text-[15px] text-white/60">Auswahl wird direkt gespeichert.</p>
      <button type="button" onClick={() => setOpen(false)} className="sz-club-event-action mt-4 min-h-12 w-full rounded-full border text-[17px] font-semibold">Abbrechen</button>
    </Modal>
  </>;
}
