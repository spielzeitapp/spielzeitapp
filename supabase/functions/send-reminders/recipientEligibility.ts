export type InjuryFlags = {
  is_injured?: boolean | null;
  injured_since?: string | null;
  injured_until?: string | null;
};

/** Evaluate the event date, not the earlier reminder date. */
export function isInjuredForReminder(player: InjuryFlags, startsAt: string | null): boolean {
  if (!player.is_injured) return false;
  const starts = Date.parse(startsAt ?? "");
  // An active injury with an unknown event date must not produce a participation prompt.
  if (!Number.isFinite(starts)) return true;
  const since = Date.parse(player.injured_since ?? "");
  const until = Date.parse(player.injured_until ?? "");
  if (Number.isFinite(since) && starts < since) return false;
  if (Number.isFinite(until) && starts > until) return false;
  return true;
}

export function isEligibleForReminder(
  kind: string,
  status: string | null | undefined,
  player: InjuryFlags,
  startsAt: string | null,
): boolean {
  if (isInjuredForReminder(player, startsAt)) return false;
  const value = String(status ?? "").trim().toLowerCase();
  const blocked = kind === "match"
    ? ["yes", "no", "sick", "injured", "external_training"]
    : ["no", "sick", "injured", "external_training"];
  return !blocked.includes(value);
}

export function filterLinkedReminderUsers(
  userIds: string[],
  playersByUser: Map<string, Set<string>>,
  eligiblePlayerIds: Set<string>,
  keepUnlinked: boolean,
): string[] {
  return userIds.filter((userId) => {
    const players = [...(playersByUser.get(userId) ?? [])];
    return players.length === 0 ? keepUnlinked : players.some((id) => eligiblePlayerIds.has(id));
  });
}
