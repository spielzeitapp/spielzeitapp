import type { FieldSlotId } from '../types/match';
export type BlockChange = { outId: string; inId: string; slot: FieldSlotId };
/** Reconcile planned membership with the actual field after individual substitutions. */
export function planBlockChange(current: Record<FieldSlotId,string|null>, target: Record<FieldSlotId,string|null>, squad: readonly string[], keepGoalkeeper: boolean) {
  const desired = {...target};
  if (keepGoalkeeper) {
    const keeper = current.GK;
    for (const slot of Object.keys(desired) as FieldSlotId[]) if (desired[slot] === keeper) desired[slot] = null;
    desired.GK = keeper;
  }
  const active = (Object.keys(current) as FieldSlotId[]).filter(s => current[s]);
  const wanted = Object.values(desired).filter((id): id is string => Boolean(id));
  if (![5,6].includes(active.length) || wanted.length !== active.length) throw new Error('Beide Blöcke müssen für 4+1 oder 5+1 vollständig aufgestellt sein.');
  if (new Set(wanted).size !== wanted.length || new Set(active.map(s=>current[s])).size !== active.length) throw new Error('Ein Spieler darf pro Block nur einmal aufgestellt sein.');
  if (wanted.some(id=>!squad.includes(id))) throw new Error('Ein Spieler des Blocks ist nicht mehr im Spielkader. Bitte Blockplanung aktualisieren.');
  const field = new Set(active.map(s=>current[s]));
  const incoming = wanted.filter(id=>!field.has(id));
  const outgoing = active.filter(slot=>!wanted.includes(current[slot]!));
  if (!keepGoalkeeper && desired.GK !== current.GK && (wanted.includes(current.GK!) || field.has(desired.GK))) throw new Error('Torwart und Feldspieler tauschen bereits Positionen. Bitte dafür den Einzel-/Positionswechsel nutzen oder Torwart beibehalten.');
  const changes: BlockChange[] = [];
  const slots = {...current};
  for (const slot of outgoing) {
    const preferred = desired[slot];
    const index = preferred && incoming.includes(preferred) ? incoming.indexOf(preferred) : 0;
    const [inId] = incoming.splice(index,1);
    if (!inId) throw new Error('Blockwechsel konnte nicht eindeutig zugeordnet werden.');
    changes.push({outId:current[slot]!,inId,slot}); slots[slot] = inId;
  }
  return {changes,slots};
}
