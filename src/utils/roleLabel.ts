const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  trainer: "Trainer",
  player: "Spieler",
  parent: "Eltern",
  fan: "Fan",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role; // fallback zeigt key
}
