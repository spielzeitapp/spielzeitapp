import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import {
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';

export function pickFeaturedTournamentSlot(
  slots: TournamentMatchSlotView[],
): TournamentMatchSlotView | null {
  const live = slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) return live;
  const open = slots
    .filter((s) => (s.match_status ?? '').toLowerCase() !== 'finished')
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
  return open[0] ?? null;
}

export function pickLastFinishedTournamentSlots(
  slots: TournamentMatchSlotView[],
  limit = 3,
): TournamentMatchSlotView[] {
  return slots
    .filter((s) => (s.match_status ?? '').toLowerCase() === 'finished')
    .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
    .slice(0, limit);
}

export type TournamentSlotSection = {
  key: string;
  label: string;
  slots: TournamentMatchSlotView[];
};

function slotSectionLabel(slot: TournamentMatchSlotView): string {
  const phase = (slot.phase ?? '').trim().toLowerCase();
  if (phase === 'final') return 'Finale';
  if (phase === 'semifinal') return 'Halbfinale';
  if (phase === 'placement') return 'Platzierung';
  const group = slot.group_label?.trim();
  if (group) return `Gruppe ${group}`;
  return tournamentPhaseDisplayLabel(slot.phase, slot.group_label);
}

function slotSectionSortKey(label: string): number {
  const l = label.toLowerCase();
  if (l.startsWith('gruppe')) return 10;
  if (l === 'halbfinale') return 20;
  if (l === 'platzierung') return 30;
  if (l === 'finale') return 40;
  return 50;
}

export function groupTournamentSlotsBySection(
  slots: TournamentMatchSlotView[],
): TournamentSlotSection[] {
  const map = new Map<string, TournamentSlotSection>();
  for (const slot of slots) {
    const label = slotSectionLabel(slot);
    const key = label.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.slots.push(slot);
    } else {
      map.set(key, { key, label, slots: [slot] });
    }
  }
  const sections = [...map.values()];
  for (const section of sections) {
    section.slots.sort(
      (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
    );
  }
  sections.sort((a, b) => {
    const diff = slotSectionSortKey(a.label) - slotSectionSortKey(b.label);
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label, 'de');
  });
  return sections;
}

export function tournamentSlotStatusTone(
  slot: TournamentMatchSlotView,
): 'live' | 'finished' | 'preparation' | 'planned' {
  const status = tournamentMatchDisplayStatus(slot);
  if (status.kind === 'live') return 'live';
  if (status.kind === 'result') return 'finished';
  if (status.kind === 'preparation') return 'preparation';
  return 'planned';
}

export async function shareTournamentCenter(title: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const url = window.location.href;
  const shareTitle = `Turniercenter — ${title}`;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: shareTitle, url });
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function splitTeamDisplayName(name: string): { club: string; ageGroup: string | null } {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.+?)\s+(U\d{1,2})\s*$/i);
  if (match) {
    return { club: match[1]!.trim(), ageGroup: match[2]!.toUpperCase() };
  }
  return { club: trimmed, ageGroup: null };
}
