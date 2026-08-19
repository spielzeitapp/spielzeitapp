/**
 * PLATZ-UX.1 – Verfügbarkeitsberechnung für den visuellen Platzbelegungskalender.
 * Pure Funktionen, keine DB-Aufrufe. Nutzt bestehende Conflict-/Zone-/TZ-Helfer.
 */

import {
  fieldUtilizationInInterval,
  intervalsOverlapHalfOpen,
  suggestFreeZones,
  type FieldConflictCandidate,
  type ZoneMeta,
} from '../../lib/fieldScheduleConflicts';
import {
  getDateTimePartsInTimeZone,
  VIENNA_TZ,
  zonedWallTimeToUtcMillis,
} from '../../lib/viennaTime';

export type PlatzViewMode = 'day' | 'week' | 'month';

export const VIEW_STORAGE_KEY = 'spielzeit_platz_view';

export type SlotStatus = 'free' | 'partial' | 'full';

export type TimeSlot = {
  startMs: number;
  endMs: number;
  startHour: number;
  startMinute: number;
  status: SlotStatus;
  /** Candidates overlapping this slot */
  occupancies: FieldConflictCandidate[];
  /** Free zones during this slot (only computed for partial/full) */
  freeZones: ZoneMeta[];
  entireFieldFree: boolean;
};

export type FieldDaySummary = {
  fieldId: string;
  fieldName: string;
  venueId: string;
  slots: TimeSlot[];
};

export type VenueDayQuickInfo = {
  venueId: string;
  venueName: string;
  fields: {
    fieldId: string;
    fieldName: string;
    currentStatus: SlotStatus;
    currentFreeZones: string[];
    nextOccupancyLabel: string | null;
  }[];
};

export type MonthDaySummary = {
  dayKey: string;
  occupancyCount: number;
  peakStatus: SlotStatus;
};

export function computeFieldSlotStatus(
  fieldId: string,
  slotStartMs: number,
  slotEndMs: number,
  candidates: readonly FieldConflictCandidate[],
  zones: readonly ZoneMeta[],
): SlotStatus {
  return fieldUtilizationInInterval({
    fieldId,
    startsAtMs: slotStartMs,
    endsAtMs: slotEndMs,
    zones,
    existing: candidates as FieldConflictCandidate[],
  });
}

export function dayKeyToViennaMs(dayKey: string, hour: number, minute: number): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return zonedWallTimeToUtcMillis({ year: y, month: m, day: d, hour, minute }, VIENNA_TZ);
}

function formatHmFromMs(ms: number): string {
  const parts = getDateTimePartsInTimeZone(new Date(ms), VIENNA_TZ);
  if (!parts) return '';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function computeFieldDaySlots(opts: {
  fieldId: string;
  dayKey: string;
  candidates: readonly FieldConflictCandidate[];
  zones: readonly ZoneMeta[];
  stepMinutes?: number;
  rangeStartHour?: number;
  rangeEndHour?: number;
}): TimeSlot[] {
  const step = opts.stepMinutes ?? 30;
  const startH = opts.rangeStartHour ?? 8;
  const endH = opts.rangeEndHour ?? 22;
  const slots: TimeSlot[] = [];

  const fieldCandidates = opts.candidates.filter((c) => c.fieldId === opts.fieldId);

  for (let h = startH; h < endH; h++) {
    const stepsPerHour = 60 / step;
    for (let s = 0; s < stepsPerHour; s++) {
      const minute = s * step;
      const startMs = dayKeyToViennaMs(opts.dayKey, h, minute);
      const endMs = dayKeyToViennaMs(opts.dayKey, h, minute + step);
      if (!startMs || !endMs) continue;

      const overlapping = fieldCandidates.filter((c) =>
        intervalsOverlapHalfOpen(startMs, endMs, c.startsAtMs, c.endsAtMs),
      );

      const status = computeFieldSlotStatus(
        opts.fieldId,
        startMs,
        endMs,
        fieldCandidates,
        opts.zones,
      );

      let freeZones: ZoneMeta[] = [];
      let entireFieldFree = true;
      if (overlapping.length > 0) {
        const suggestion = suggestFreeZones({
          fieldId: opts.fieldId,
          startsAtMs: startMs,
          endsAtMs: endMs,
          zones: opts.zones,
          existing: overlapping,
        });
        freeZones = suggestion.freeZones;
        entireFieldFree = suggestion.entireFieldFree;
      }

      slots.push({
        startMs,
        endMs,
        startHour: h,
        startMinute: minute,
        status,
        occupancies: overlapping,
        freeZones,
        entireFieldFree,
      });
    }
  }

  return slots;
}

export function computeVenueDaySummary(opts: {
  venueId: string;
  venueName: string;
  fields: readonly { id: string; name: string; venue_id: string; is_active?: boolean }[];
  dayKey: string;
  candidates: readonly FieldConflictCandidate[];
  zones: Record<string, readonly ZoneMeta[]>;
  now?: Date;
}): VenueDayQuickInfo {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const venueFields = opts.fields.filter(
    (f) => f.venue_id === opts.venueId && f.is_active !== false,
  );

  const fieldInfos = venueFields.map((f) => {
    const fieldCandidates = opts.candidates.filter((c) => c.fieldId === f.id);
    const fieldZones = (opts.zones[f.id] ?? []) as ZoneMeta[];

    const currentSlotEnd = nowMs + 30 * 60 * 1000;
    const currentStatus = computeFieldSlotStatus(
      f.id, nowMs, currentSlotEnd, fieldCandidates, fieldZones,
    );

    let currentFreeZones: string[] = [];
    if (currentStatus === 'partial') {
      const suggestion = suggestFreeZones({
        fieldId: f.id,
        startsAtMs: nowMs,
        endsAtMs: currentSlotEnd,
        zones: fieldZones,
        existing: fieldCandidates.filter((c) =>
          intervalsOverlapHalfOpen(nowMs, currentSlotEnd, c.startsAtMs, c.endsAtMs),
        ),
      });
      currentFreeZones = suggestion.freeZones.map((z) => z.name);
    }

    const future = fieldCandidates
      .filter((c) => c.startsAtMs > nowMs)
      .sort((a, b) => a.startsAtMs - b.startsAtMs);
    const nextOcc = future[0];
    const nextOccupancyLabel = nextOcc ? `Nächste Belegung um ${formatHmFromMs(nextOcc.startsAtMs)}` : null;

    return {
      fieldId: f.id,
      fieldName: f.name,
      currentStatus,
      currentFreeZones,
      nextOccupancyLabel,
    };
  });

  return {
    venueId: opts.venueId,
    venueName: opts.venueName,
    fields: fieldInfos,
  };
}

export function computeFieldMonthSummary(opts: {
  fieldId: string;
  dayKeys: readonly string[];
  candidates: readonly FieldConflictCandidate[];
  zones: readonly ZoneMeta[];
}): MonthDaySummary[] {
  const fieldCandidates = opts.candidates.filter((c) => c.fieldId === opts.fieldId);

  return opts.dayKeys.map((dayKey) => {
    const dayStartMs = dayKeyToViennaMs(dayKey, 0, 0);
    const dayEndMs = dayKeyToViennaMs(dayKey, 23, 59) + 60_000;

    const overlapping = fieldCandidates.filter((c) =>
      intervalsOverlapHalfOpen(dayStartMs, dayEndMs, c.startsAtMs, c.endsAtMs),
    );

    let peakStatus: SlotStatus = 'free';
    if (overlapping.length > 0) {
      const sampleSlots = [8, 10, 12, 14, 16, 18, 20];
      for (const h of sampleSlots) {
        const slotStart = dayKeyToViennaMs(dayKey, h, 0);
        const slotEnd = dayKeyToViennaMs(dayKey, h + 1, 0);
        const s = computeFieldSlotStatus(opts.fieldId, slotStart, slotEnd, fieldCandidates, opts.zones);
        if (s === 'full') { peakStatus = 'full'; break; }
        if (s === 'partial') peakStatus = 'partial';
      }
    }

    return { dayKey, occupancyCount: overlapping.length, peakStatus };
  });
}

export const STATUS_LABELS: Record<SlotStatus, string> = {
  free: 'Frei',
  partial: 'Teilbelegt',
  full: 'Belegt',
};

export function readStoredViewMode(userId: string | null | undefined): PlatzViewMode {
  if (!userId) return 'day';
  try {
    const raw = window.localStorage.getItem(`${VIEW_STORAGE_KEY}:${userId}`);
    if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  } catch { /* ignore */ }
  return 'day';
}

export function writeStoredViewMode(userId: string | null | undefined, mode: PlatzViewMode): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${VIEW_STORAGE_KEY}:${userId}`, mode);
  } catch { /* ignore */ }
}
