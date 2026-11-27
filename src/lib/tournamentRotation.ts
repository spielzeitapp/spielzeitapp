import type { FieldSlotId } from '../types/match';
import type { MatchLineupVariantDraft, StoredMatchLineupVariants } from './matchLineupVariants';

export type RotationRole = 'defence' | 'middle' | 'attack';
export type RotationFrame = { minute: number; slots: Record<FieldSlotId, string | null> };
export type RotationGame = { mode: 'scheduled' | 'free'; anchorId?: string; frames?: RotationFrame[] };
export type TournamentRotation = {
  version: 1;
  positions: Record<string, RotationRole[]>;
  games: Record<string, RotationGame>;
};
export const rotationRoleLabels: Record<RotationRole, string> = { defence: 'Hinten', middle: 'Mitte', attack: 'Vorne' };
const fieldSlots: FieldSlotId[] = ['LB', 'RB', 'CM', 'LW', 'RW'];
export function roleForRotationSlot(slot: FieldSlotId): RotationRole {
  return slot === 'LB' || slot === 'RB' ? 'defence' : slot === 'CM' ? 'middle' : 'attack';
}
export function sameRotationSlots(a: RotationFrame['slots'], b: RotationFrame['slots']) {
  return (['GK', ...fieldSlots, 'ST', 'FP'] as FieldSlotId[]).every(s => (a[s] ?? null) === (b[s] ?? null));
}
export function rotationModeForPhase(phase?: string | null): RotationGame['mode'] | null {
  if (phase === 'group') return 'scheduled';
  if (['placement', 'semifinal', 'final', 'quarterfinal', 'knockout'].includes(phase ?? '')) return 'free';
  return null; // Unknown imported phases require a trainer's choice.
}
export function rotationMinutes(frames: RotationFrame[], duration = 12): Record<string, number> {
  const minutes: Record<string, number> = {};
  frames.forEach((frame, index) => {
    const length = (frames[index + 1]?.minute ?? duration) - frame.minute;
    Object.values(frame.slots).forEach(id => { if (id) minutes[id] = (minutes[id] ?? 0) + length; });
  });
  return minutes;
}
/** Four sections, two substitutions at 3/6/9, fixed keeper, one fixed outfielder.
 * Shared players keep their slot, making the plan executable by existing live events.
 * Every other outfielder receives exactly six minutes. Never relax positions silently.
 */
export function generateTournamentRotation(start: MatchLineupVariantDraft, positions: TournamentRotation['positions'], anchorId: string, duration = 12): RotationFrame[] {
  if (duration !== 12 || start.formationId !== '1-2-1-2') throw new Error('Diese Wechselplanung benötigt 12 Minuten und die Formation 2–1–2 (5+1).');
  const keeper = start.slots.GK;
  const squad = start.squadIds;
  if (squad.length !== 10 || new Set(squad).size !== 10 || !keeper || !squad.includes(keeper)) throw new Error('Bitte neun Feldspieler und einen festen Tormann nominieren.');
  if (start.slots.ST || start.slots.FP) throw new Error('Bitte nur die Positionen der Formation 2–1–2 besetzen.');
  const active = fieldSlots.map(s => start.slots[s]);
  if (active.some(id => !id || !squad.includes(id)) || new Set([keeper, ...active]).size !== 6 || !active.includes(anchorId)) throw new Error('Startaufstellung vollständig besetzen und einen Feldspieler daraus zum Durchspielen wählen.');
  for (const slot of fieldSlots) if (!positions[start.slots[slot]!]?.includes(roleForRotationSlot(slot))) throw new Error('Die Startaufstellung passt noch nicht zu den freigegebenen Spielerpositionen.');
  const bench = squad.filter(id => id !== keeper && !active.includes(id));
  const rotating = fieldSlots.filter(s => start.slots[s] !== anchorId);
  // Backtracking matches all four substitutes to permitted positions.
  function assign(index: number, remaining: string[], slots: RotationFrame['slots']): RotationFrame['slots'] | null {
    if (index === rotating.length) return slots;
    const slot = rotating[index];
    for (const id of remaining) {
      if (!positions[id]?.includes(roleForRotationSlot(slot))) continue;
      const result = assign(index + 1, remaining.filter(x => x !== id), { ...slots, [slot]: id });
      if (result) return result;
    }
    return null;
  }
  const middle = assign(0, bench, { ...start.slots });
  if (!middle) throw new Error('Mit diesem Durchspieler lassen sich Positionen und sechs Minuten für alle nicht einhalten. Anderen Durchspieler oder Startaufstellung wählen.');
  // Prefer one defensive and one offensive replacement at each change.
  const pairs = rotating.flatMap((a, i) => rotating.slice(i + 1).map(b => [a, b]));
  pairs.sort((a, b) => Number(roleForRotationSlot(a[0]) === roleForRotationSlot(a[1])) - Number(roleForRotationSlot(b[0]) === roleForRotationSlot(b[1])));
  const firstPair = pairs[0];
  const second = { ...start.slots };
  firstPair.forEach(slot => { second[slot] = middle[slot]; });
  const last = { ...middle };
  firstPair.forEach(slot => { last[slot] = start.slots[slot]; });
  return [{ minute: 0, slots: { ...start.slots } }, { minute: 3, slots: second }, { minute: 6, slots: middle }, { minute: 9, slots: last }];
}
export function validateRotationGame(game: RotationGame, start: MatchLineupVariantDraft, positions: TournamentRotation['positions'], duration = 12): void {
  if (!['free', 'scheduled'].includes(game.mode)) throw new Error('Wechselmodus auswählen.');
  if (game.mode === 'free') return;
  const frames = game.frames;
  if (!frames || frames.length !== 4 || !sameRotationSlots(frames[0].slots, start.slots)) throw new Error('Wechselplan nach Änderung der Startaufstellung neu erstellen.');
  generateTournamentRotation(start, positions, game.anchorId ?? '', duration);
  frames.forEach((frame, index) => {
    const ids = Object.values(frame.slots).filter(Boolean);
    if (frame.minute !== index * 3 || frame.slots.GK !== start.slots.GK || ids.length !== 6 || new Set(ids).size !== 6 || ids.some(id => !start.squadIds.includes(id!))) throw new Error('Ungültiger Spielabschnitt. Wechselplan neu erstellen.');
    for (const slot of fieldSlots) if (!frame.slots[slot] || !positions[frame.slots[slot]!]?.includes(roleForRotationSlot(slot))) throw new Error('Spielerpositionen wurden geändert. Wechselplan neu erstellen.');
    if (index) {
      const changed = fieldSlots.filter(s => frame.slots[s] !== frames[index - 1].slots[s]);
      const oldIds = Object.values(frames[index - 1].slots);
      if (changed.length !== 2 || changed.some(s => oldIds.includes(frame.slots[s]))) throw new Error('Pro Abschnitt sind genau zwei Einwechselspieler erforderlich.');
    }
  });
  const minutes = rotationMinutes(frames);
  if (start.squadIds.some(id => minutes[id] !== (id === start.slots.GK || id === game.anchorId ? 12 : 6))) throw new Error('Spielzeiten passen nicht zum Wechselmodell.');
}
export function resolveRotationForMatch(blocks: StoredMatchLineupVariants, matchId: string, phase?: string | null, duration = 12): StoredMatchLineupVariants {
  if (!blocks.rotation) return blocks;
  const next = structuredClone(blocks);
  const configured = blocks.rotation.games[matchId];
  const mode = configured?.mode ?? rotationModeForPhase(phase);
  if (!mode) throw new Error('Für dieses Spiel zuerst Gruppen- oder freie Wechsel festlegen.');
  const game: RotationGame = configured ?? { mode };
  validateRotationGame(game, blocks.variants[blocks.startVariant], blocks.rotation.positions, duration);
  next.rotationMatch = structuredClone(game);
  // Scheduled control is separate from the legacy A/B toggle.
  next.lineupMode = 'single';
  next.variants[2] = structuredClone(next.variants[next.startVariant]);
  next.variants[1] = structuredClone(next.variants[next.startVariant]);
  next.startVariant = 1;
  return next;
}
