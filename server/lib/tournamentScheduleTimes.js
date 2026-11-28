/**
 * Keep the local delay until the organizer publishes a different time for this fixture.
 * Both dates come from timestamptz columns and may use different offset spellings.
 */
export function effectiveTournamentKickoff(slot) {
  if (typeof slot.kickoff_actual_at === 'string') return slot.kickoff_actual_at;
  const kickoff = typeof slot.kickoff_at === 'string' ? slot.kickoff_at : '';
  if (typeof slot.kickoff_delay_until === 'string' &&
    Date.parse(slot.kickoff_delay_source_at ?? '') === Date.parse(kickoff)) {
    return slot.kickoff_delay_until;
  }
  return kickoff;
}
