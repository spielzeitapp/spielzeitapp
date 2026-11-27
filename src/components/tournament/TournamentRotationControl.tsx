import React, { useState } from 'react';
import type { FieldSlotId } from '../../types/match';
import type { StoredMatchLineupVariants } from '../../lib/matchLineupVariants';
import { planBlockChange, type BlockChange } from '../../lib/tournamentBlocks';
import { sameRotationSlots, validateRotationGame, rotationRoleLabels, type RotationRole } from '../../lib/tournamentRotation';

type Props = {
  stored: StoredMatchLineupVariants; seconds: number; running?: boolean;
  current: Record<FieldSlotId, string | null>; squad: string[]; name: (id: string) => string;
  busy: boolean; onApply: (changes: BlockChange[], slots: Record<FieldSlotId, string | null>) => Promise<boolean>;
};
export function TournamentRotationControl({ stored, seconds, running, current, squad, name, busy, onApply }: Props) {
  const [review, setReview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const game = stored.rotationMatch;
  if (!game) return <p role="alert" className="p-3 text-amber-200">Wechselplan für dieses Spiel zuerst vorbereiten. Einzelwechsel bleiben möglich.</p>;
  const bench = squad.filter(id => !Object.values(current).includes(id));
  if (game.mode === 'free') return <section aria-label="Freie Turnierwechsel" className="space-y-2 rounded-2xl border sz-club-surface p-3 text-base text-white">
    <h3 className="font-bold">Freie Wechsel · Platzierung</h3>
    <p className="text-white/70">Mit der Startaufstellung beginnen und über „Wechsel“ nach Spielverlauf tauschen. Kein fester Durchspieler.</p>
    {(Object.keys(rotationRoleLabels) as RotationRole[]).map(role => <p key={role}><strong>{rotationRoleLabels[role]}:</strong> {bench.filter(id => stored.rotation?.positions[id]?.includes(role)).map(name).join(', ') || 'Kein passender Ersatzspieler auf der Bank'}</p>)}
    <p className="text-sm text-white/60">Tormann bleibt laut Planung fix. Tatsächliche Spielzeit entsteht aus den bestätigten Wechseln.</p>
  </section>;
  let reason = '';
  try { validateRotationGame(game, stored.variants[stored.startVariant], stored.rotation?.positions ?? {}); }
  catch (e) { reason = (e as Error).message; }
  if (game.frames?.some(frame => Object.values(frame.slots).some(id => id && !squad.includes(id)))) reason = 'Spielkader geändert. Wechselplan neu prüfen; Einzelwechsel bleiben möglich.';
  const frames = game.frames ?? [];
  const index = frames.findIndex(frame => sameRotationSlots(frame.slots, current));
  const next = index >= 0 ? frames[index + 1] : undefined;
  if (!reason && index < 0) reason = 'Aktuelle Aufstellung weicht vom Plan ab. Bitte Einzelwechsel nutzen oder den geplanten Stand wiederherstellen.';
  let plan: ReturnType<typeof planBlockChange> | null = null;
  if (!reason && next) {
    try {
      plan = planBlockChange(current, next.slots, squad, true);
      if (plan.changes.length !== 2 || !sameRotationSlots(plan.slots, next.slots)) throw new Error('Aktuelle Positionen passen nicht zum nächsten Abschnitt. Einzelwechsel nutzen.');
    } catch (e) { reason = (e as Error).message; plan = null; }
  }
  const remaining = next ? Math.max(0, Math.ceil(next.minute * 60 - seconds)) : 0;
  const snapshot = JSON.stringify({ current, next, plan });
  const reviewed = review === snapshot;
  const apply = async () => {
    if (!plan || !next || busy || saving || !running || seconds < next.minute * 60 || seconds >= 720) return;
    if (!reviewed) { setReview(snapshot); return; }
    setSaving(true); setError('');
    try {
      if (await onApply(plan.changes, plan.slots)) setReview('');
      else setError('Wechsel nicht gespeichert. Aktuellen Stand prüfen und erneut bestätigen.');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };
  return <section aria-label="Geplante Zwei-Spieler-Wechsel" className="space-y-3 rounded-2xl border sz-club-surface p-3 text-base text-white">
    <h3 className="font-bold">Gruppenspiel · 2 Wechsel alle 3 Minuten</h3>
    <p className="text-white/70">Durchspieler: {name(game.anchorId!)} · Tormann fix: {name(frames[0]?.slots.GK ?? '')}</p>
    {reason ? <p role="alert" className="text-amber-200">{reason}</p> : next ? <>
      <p role="timer" className="font-bold">{seconds >= 720 ? 'Spielzeit beendet' : remaining ? `Wechsel bei ${next.minute}:00 · noch ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : `Wechsel bei ${next.minute}:00 fällig`}</p>
      <ul className="space-y-2">{plan?.changes.map(change => <li key={change.outId}>{name(change.outId)} raus · {name(change.inId)} rein</li>)}</ul>
      <button type="button" disabled={!plan || busy || saving || !running || remaining > 0 || seconds >= 720} onClick={() => void apply()} className="min-h-12 w-full rounded-xl border sz-club-tab-active px-3 py-2 font-bold disabled:opacity-40">{saving ? 'Speichert…' : reviewed ? 'Zwei Wechsel bestätigen' : 'Zwei Wechsel prüfen'}</button>
      {reviewed ? <button type="button" className="min-h-11 underline" onClick={() => setReview('')}>Abbrechen</button> : null}
    </> : <p className="text-emerald-300">Schlussbesetzung · kein weiterer geplanter Wechsel.</p>}
    {error ? <p role="alert" className="text-amber-200">{error}</p> : null}
    <p className="text-sm text-white/60">Jeder Wechsel wird bestätigt und als tatsächliches Spielereignis gespeichert. Einzelwechsel sind jederzeit möglich.</p>
  </section>;
}
