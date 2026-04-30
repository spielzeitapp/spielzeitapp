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
