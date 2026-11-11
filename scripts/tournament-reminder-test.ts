import assert from "node:assert/strict";
import {
  isCurrentTournamentReminder as valid,
  tournamentReminderRecipients,
} from "../supabase/functions/send-reminders/tournamentReminder";
const now = Date.parse("2026-11-11T12:00:00Z");
const kickoff = new Date(now + 5 * 60_000).toISOString();
const s = {
  is_own_team: true,
  tournament_event_id: "event",
  kickoff_at: kickoff,
  opponent_name: "Team B",
  official_status: "upcoming",
};
const e = { status: "live", tournament_completed_at: null };
const m = { status: "upcoming" };
const p = { kickoff, opponent: "Team B" };
assert.equal(valid(s, e, m, "event", p, now), true);
assert.equal(
  valid(
    { ...s, kickoff_at: new Date(now + 6 * 60_000).toISOString() },
    e,
    m,
    "event",
    p,
    now,
  ),
  false,
);
assert.equal(valid(s, { ...e, status: "finished" }, m, "event", p, now), false);
assert.equal(valid(s, e, { status: "live" }, "event", p, now), false);
assert.equal(
  valid({ ...s, official_status: "finished" }, e, m, "event", p, now),
  false,
);
assert.equal(
  valid({ ...s, opponent_name: "Team C" }, e, m, "event", p, now),
  false,
);
assert.equal(valid(s, e, m, "event", p, now + 5 * 60_000), false);
assert.deepEqual(
  tournamentReminderRecipients(
    [{ user_id: "fan" }, { user_id: "former-member" }, { user_id: "fan" }],
    [{ user_id: "fan" }, { user_id: "trainer" }],
  ),
  ["fan"],
);
console.log(
  "Tournament delivery: five-minute window, cancellations, changed kickoff/opponent, started games and opted-in current fans OK",
);
