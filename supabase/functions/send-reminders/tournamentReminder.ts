/** Revalidate at delivery, including late organizer changes and revoked subscriptions. */
export function isCurrentTournamentReminder(
  slot: {
    is_own_team?: boolean;
    tournament_event_id?: string;
    kickoff_at?: string;
    opponent_name?: string;
    official_status?: string;
  } | null,
  event: { status?: string; tournament_completed_at?: string | null } | null,
  match: { status?: string } | null,
  eventId: string | null,
  payload: Record<string, unknown>,
  now = Date.now(),
): boolean {
  const kickoff = Date.parse(String(slot?.kickoff_at ?? ""));
  return Boolean(
    slot?.is_own_team &&
    slot.tournament_event_id === eventId &&
    match?.status === "upcoming" &&
    slot.official_status !== "finished" &&
    kickoff === Date.parse(String(payload.kickoff)) &&
    kickoff > now &&
    kickoff <= now + 5 * 60_000 &&
    slot.opponent_name === payload.opponent &&
    event &&
    !event.tournament_completed_at &&
    !["cancelled", "canceled", "deleted", "finished"].includes(
      event.status ?? "",
    ),
  );
}
export function tournamentReminderRecipients(
  subscribed: Array<{ user_id: string }>,
  members: Array<{ user_id: string }>,
): string[] {
  const allowed = new Set(members.map((m) => m.user_id));
  return [
    ...new Set(
      subscribed.map((s) => String(s.user_id)).filter((id) => allowed.has(id)),
    ),
  ];
}
