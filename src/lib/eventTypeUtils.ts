/** DB `events.kind` inkl. Turnier (MVP Step 1). */
export const EVENT_KINDS = ['match', 'training', 'event', 'tournament'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** UI/Schedule-Kanonischer Termin-Typ (abgeleitet aus kind + type). */
export const EFFECTIVE_EVENT_TYPES = ['game', 'training', 'event', 'other', 'tournament'] as const;
export type EffectiveEventType = (typeof EFFECTIVE_EVENT_TYPES)[number];

export type EventTypeField = 'game' | 'training' | 'event' | 'other' | 'tournament';

export function normalizeEventKind(raw: string | null | undefined): EventKind {
  const k = (raw ?? '').trim().toLowerCase();
  if (k === 'match' || k === 'training' || k === 'event' || k === 'tournament') return k;
  return 'event';
}

export function normalizeEventTypeField(
  kind: string,
  typeRaw?: string | null,
): EventTypeField {
  const k = normalizeEventKind(kind);
  // kind hat Vorrang (verhindert Anzeige „Termin“ bei fehlerhaftem type-Fallback)
  if (k === 'tournament') return 'tournament';
  if (k === 'match') return 'game';
  if (k === 'training') return 'training';
  const t = (typeRaw ?? '').trim().toLowerCase();
  if (t === 'game' || t === 'training' || t === 'event' || t === 'other' || t === 'tournament') {
    return t;
  }
  if (k === 'event') return 'event';
  return 'other';
}

export function getEffectiveEventType(e: {
  kind: string;
  type?: string | null;
}): EffectiveEventType {
  return normalizeEventTypeField(e.kind, e.type);
}

export function isTournamentEvent(e: { kind: string; type?: string | null }): boolean {
  return getEffectiveEventType(e) === 'tournament';
}

export function isMatchLikeEvent(e: { kind: string; type?: string | null }): boolean {
  return getEffectiveEventType(e) === 'game';
}

export function eventKindLabelDe(kind: string | null | undefined): string {
  const k = normalizeEventKind(kind);
  if (k === 'match') return 'Spiel';
  if (k === 'training') return 'Training';
  if (k === 'tournament') return 'Turnier';
  return 'Event';
}

export function effectiveEventTypeLabelDe(et: EffectiveEventType): string {
  if (et === 'game') return 'Spiel';
  if (et === 'training') return 'Training';
  if (et === 'tournament') return 'Turnier';
  if (et === 'event') return 'Event';
  return 'Termin';
}

/** kind für DB-Insert aus Formular-Auswahl. */
export function eventKindFromFormType(
  formType: 'game' | 'training' | 'event' | 'other' | 'tournament',
): EventKind {
  if (formType === 'game') return 'match';
  if (formType === 'training') return 'training';
  if (formType === 'tournament') return 'tournament';
  return 'event';
}
