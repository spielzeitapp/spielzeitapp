type BirthDisplayRole = string | null | undefined;

function formatDeDayMonth(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const day = m[3];
  const month = m[2];
  return `${day}.${month}.`;
}

function formatDeFullDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const year = m[1];
  const month = m[2];
  const day = m[3];
  return `${day}.${month}.${year}`;
}

function normalizeRole(role: BirthDisplayRole): string {
  return (role ?? "").trim().toLowerCase();
}

export function getPlayerBirthDisplayLines(
  role: BirthDisplayRole,
  birthdate: string | null | undefined
): string[] {
  if (!birthdate) return [];
  const r = normalizeRole(role);
  const full = formatDeFullDate(birthdate);
  const dm = formatDeDayMonth(birthdate);
  if (!full || !dm) return [];

  if (r === "trainer" || r === "co_trainer" || r === "head_coach" || r === "admin") {
    return [`Geboren: ${full}`];
  }
  if (r === "parent" || r === "player") {
    return [`Geburtstag: ${dm}`];
  }
  return [];
}
