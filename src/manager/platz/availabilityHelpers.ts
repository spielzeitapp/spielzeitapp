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

// ─── PLATZ-UX.1A: Teilflächen-Segmente und Bruchtext ───

export type ZoneSegment = {
  zoneId: string;
  zoneName: string;
  occupied: boolean;
};

export type BlockSpatialInfo = {
  status: SlotStatus;
  segments: ZoneSegment[];
  fractionLabel: string;
  accessibleLabel: string;
  /** true when geometry is unclear and we show a safe fallback */
  geometryUnclear: boolean;
};

/**
 * Compute spatial info for a specific field during a time interval.
 * Returns segments (which zones are occupied/free), fraction label, and status.
 */
export function computeBlockSpatialInfo(opts: {
  fieldId: string;
  startsAtMs: number;
  endsAtMs: number;
  candidates: readonly FieldConflictCandidate[];
  zones: readonly ZoneMeta[];
  blockLabel?: string;
  teamLabel?: string;
  timeLabel?: string;
}): BlockSpatialInfo {
  const fieldCandidates = opts.candidates.filter(
    (c) => c.fieldId === opts.fieldId &&
      intervalsOverlapHalfOpen(opts.startsAtMs, opts.endsAtMs, c.startsAtMs, c.endsAtMs),
  );

  if (fieldCandidates.length === 0) {
    return {
      status: 'free',
      segments: [],
      fractionLabel: 'Frei',
      accessibleLabel: 'Frei',
      geometryUnclear: false,
    };
  }

  // Check if any candidate blocks the entire field
  if (fieldCandidates.some((c) => c.blocksEntireField || c.zoneId == null)) {
    const allZones = opts.zones.filter((z) => !z.blocksEntireField && z.isActive !== false);
    return {
      status: 'full',
      segments: allZones.map((z) => ({ zoneId: z.id, zoneName: z.name, occupied: true })),
      fractionLabel: 'Voll belegt',
      accessibleLabel: buildAccessibleLabel('full', [], allZones.map((z) => z.name), opts),
      geometryUnclear: false,
    };
  }

  // Compute free zones
  const suggestion = suggestFreeZones({
    fieldId: opts.fieldId,
    startsAtMs: opts.startsAtMs,
    endsAtMs: opts.endsAtMs,
    zones: opts.zones,
    existing: fieldCandidates,
  });

  const activeZones = opts.zones.filter((z) => !z.blocksEntireField && z.isActive !== false);

  // Geometry unclear fallback: if there are candidates with zone IDs but no
  // matching zone metadata, we can't determine spatial layout
  if (activeZones.length === 0 && fieldCandidates.length > 0) {
    return {
      status: 'partial',
      segments: [],
      fractionLabel: 'Teilbelegt – Details öffnen',
      accessibleLabel: 'Teilbelegt, Geometrie unklar',
      geometryUnclear: true,
    };
  }

  const freeIds = new Set(suggestion.freeZones.map((z) => z.id));
  const segments: ZoneSegment[] = activeZones.map((z) => ({
    zoneId: z.id,
    zoneName: z.name,
    occupied: !freeIds.has(z.id),
  }));

  const totalCount = segments.length;
  const occupiedCount = segments.filter((s) => s.occupied).length;
  const freeCount = totalCount - occupiedCount;

  let status: SlotStatus;
  if (occupiedCount === 0) status = 'free';
  else if (freeCount === 0) status = 'full';
  else status = 'partial';

  const fractionLabel = buildFractionLabel(occupiedCount, freeCount, totalCount);
  const occupiedNames = segments.filter((s) => s.occupied).map((s) => s.zoneName);
  const freeNames = segments.filter((s) => !s.occupied).map((s) => s.zoneName);
  const accessibleLabel = buildAccessibleLabel(status, freeNames, occupiedNames, opts);

  return { status, segments, fractionLabel, accessibleLabel, geometryUnclear: false };
}

function buildFractionLabel(occupied: number, free: number, total: number): string {
  if (occupied === 0) return 'Frei';
  if (free === 0) return 'Voll belegt';
  const oFrac = fractionText(occupied, total);
  const fFrac = fractionText(free, total);
  return `${oFrac} belegt · ${fFrac} frei`;
}

function fractionText(n: number, total: number): string {
  if (total === 2) return n === 1 ? '½' : `${n}/${total}`;
  if (total === 3) {
    if (n === 1) return '⅓';
    if (n === 2) return '⅔';
  }
  if (total === 4) {
    if (n === 1) return '¼';
    if (n === 2) return '½';
    if (n === 3) return '¾';
  }
  return `${n}/${total}`;
}

function buildAccessibleLabel(
  status: SlotStatus,
  freeNames: string[],
  occupiedNames: string[],
  opts: { blockLabel?: string; teamLabel?: string; timeLabel?: string },
): string {
  const parts: string[] = [];
  if (opts.blockLabel && opts.teamLabel) parts.push(`${opts.blockLabel} ${opts.teamLabel}`);
  if (opts.timeLabel) parts.push(opts.timeLabel);
  if (status === 'full') {
    parts.push('Voll belegt');
  } else if (status === 'partial') {
    if (occupiedNames.length) parts.push(`${occupiedNames.join(', ')} belegt`);
    if (freeNames.length) parts.push(`${freeNames.join(', ')} frei`);
  } else {
    parts.push('Frei');
  }
  return parts.join(', ');
}

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
