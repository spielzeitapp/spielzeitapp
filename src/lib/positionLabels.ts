export const POSITION_LABELS: Record<string, string> = {
  GK: "TW",
  LB: "LV",
  RB: "RV",
  LS: "LF",
  RS: "RF",
  LA: "LF",
  RA: "RF",
  LV: "LV",
  RV: "RV",
  CM: "ZM",
  LM: "LF",
  RM: "RF",
  LW: "LF",
  RW: "RF",
  ST: "ST",
};

export const POSITION_FULL: Record<string, string> = {
  GK: "Torwart",
  LB: "Linksverteidiger",
  RB: "Rechtsverteidiger",
  LS: "Linker Flügel",
  RS: "Rechter Flügel",
  LA: "Linker Flügel",
  RA: "Rechter Flügel",
  LV: "Linksverteidiger",
  RV: "Rechtsverteidiger",
  CM: "Zentrales Mittelfeld",
  LM: "Linker Flügel",
  RM: "Rechter Flügel",
  LW: "Linker Flügel",
  RW: "Rechter Flügel",
  ST: "Stürmer",
};

export function getPositionLabel(pos?: string | null) {
  if (!pos) return "";
  return POSITION_LABELS[pos] ?? pos;
}

export function getPositionFull(pos?: string | null) {
  if (!pos) return "";
  return POSITION_FULL[pos] ?? pos;
}

/** Vereinfachte Rollen für Training-Listen (Klartext statt Kürzel). */
const TRAINING_ROLE_DISPLAY: Record<string, string> = {
  GK: "Torwart",
  TW: "Torwart",
  ST: "Stürmer",
  VT: "Verteidiger",
  IV: "Verteidiger",
  LV: "Verteidiger",
  RV: "Verteidiger",
  LB: "Verteidiger",
  RB: "Verteidiger",
  CM: "Mittelfeld",
  ZM: "Mittelfeld",
  MF: "Mittelfeld",
  DM: "Mittelfeld",
  AM: "Mittelfeld",
  OM: "Mittelfeld",
  LW: "Mittelfeld",
  RW: "Mittelfeld",
  LF: "Mittelfeld",
  RF: "Mittelfeld",
  LS: "Mittelfeld",
  RS: "Mittelfeld",
  LA: "Mittelfeld",
  RA: "Mittelfeld",
  LM: "Mittelfeld",
  RM: "Mittelfeld",
};

/**
 * Lesbare Position für Training-Teilnahme (z. B. „Stürmer“, „Verteidiger“).
 */
export function getTrainingPositionDisplay(pos?: string | null): string {
  const raw = (pos ?? "").trim();
  if (!raw) return "—";

  const upper = raw.toUpperCase();
  if (TRAINING_ROLE_DISPLAY[upper]) return TRAINING_ROLE_DISPLAY[upper];

  const fromFull = getPositionFull(raw).trim();
  if (fromFull && fromFull !== raw) return fromFull;

  const fromShort = getPositionLabel(raw).trim();
  if (fromShort && TRAINING_ROLE_DISPLAY[fromShort.toUpperCase()]) {
    return TRAINING_ROLE_DISPLAY[fromShort.toUpperCase()];
  }

  if (raw.length > 3 && !/^[A-Z]{2,4}$/.test(raw)) return raw;
  if (fromShort && fromShort !== raw) return fromShort;
  return raw;
}

/** Subline für Training-Cards: „Stürmer · Nr. 9“. */
export function formatTrainingPlayerSubline(
  position?: string | null,
  jerseyNumber?: number | null,
): string {
  const posLabel = getTrainingPositionDisplay(position);
  const num =
    jerseyNumber != null && Number.isFinite(Number(jerseyNumber))
      ? `Nr. ${jerseyNumber}`
      : null;
  if (posLabel === "—" && !num) return "—";
  return [posLabel !== "—" ? posLabel : null, num].filter(Boolean).join(" · ");
}

export type ProfilePositionBadge = {
  emoji: string;
  label: string;
};

/** FIFA-Karten-Badge für Spielerprofil-Hero (UI only). */
export function getProfilePositionBadge(pos?: string | null): ProfilePositionBadge | null {
  const display = getTrainingPositionDisplay(pos);
  if (display === "—") return null;

  const badges: Record<string, ProfilePositionBadge> = {
    Torwart: { emoji: "🥅", label: "Torwart" },
    Verteidiger: { emoji: "🛡", label: "Verteidiger" },
    Mittelfeld: { emoji: "⚡", label: "Mittelfeld" },
    Stürmer: { emoji: "🎯", label: "Stürmer" },
  };

  return badges[display] ?? { emoji: "⚽", label: display };
}

export function isGoalkeeperProfilePosition(pos?: string | null): boolean {
  return getTrainingPositionDisplay(pos) === "Torwart";
}
