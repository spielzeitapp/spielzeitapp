import { createClient } from "@supabase/supabase-js";

function role(value) {
  const r = String(value || "").trim().toLowerCase();
  if (["admin", "administrator", "platform_admin"].includes(r)) return "admin";
  if (["trainer", "co_trainer", "head_coach", "coach"].includes(r)) return "trainer";
  return r;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Server-Konfiguration fehlt" });
  }
  const teamSeasonId = typeof req.query.team_season_id === "string" ? req.query.team_season_id.trim() : "";
  if (!teamSeasonId) return res.status(400).json({ ok: false, error: "team_season_id fehlt" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authErr } = await db.auth.getUser(token);
  if (authErr || !authData?.user?.id) return res.status(401).json({ ok: false, error: "Invalid session" });
  const userId = authData.user.id;
  const [{ data: global }, { data: membership }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    db.from("memberships").select("role").eq("user_id", userId).eq("team_season_id", teamSeasonId).maybeSingle(),
  ]);
  if (role(global?.role) !== "admin" && role(membership?.role) !== "trainer") {
    return res.status(403).json({ ok: false, error: "Nur Trainer oder Admin" });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 45 * 86400000).toISOString();
  const { data: events, error: eventsErr } = await db
    .from("events")
    .select("id, starts_at, meeting_at, opponent, status, kind, type")
    .eq("team_season_id", teamSeasonId)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", horizon)
    .order("starts_at", { ascending: true });
  if (eventsErr) return res.status(500).json({ ok: false, error: eventsErr.message });
  const matches = (events || []).filter((e) => String(e.kind || e.type || "").toLowerCase() === "match").slice(0, 6);
  if (!matches.length) return res.status(200).json({ ok: true, matches: [] });

  const eventIds = matches.map((e) => e.id);
  const [{ data: roster, error: rosterErr }, { data: attendance, error: attendanceErr }, { data: jobs, error: jobsErr }] = await Promise.all([
    db.from("team_season_players").select("player_id, status, is_active, left_at, players:player_id(id, first_name, last_name)").eq("team_season_id", teamSeasonId),
    db.from("event_attendance").select("event_id, player_id, status").in("event_id", eventIds),
    db.from("notification_jobs").select("id, event_id, status, sent_at, send_at, payload").in("event_id", eventIds).eq("kind", "match").order("send_at", { ascending: false }),
  ]);
  if (rosterErr || attendanceErr || jobsErr) return res.status(500).json({ ok: false, error: (rosterErr || attendanceErr || jobsErr).message });

  const playerRows = (roster || []).filter((r) => r.is_active !== false && !r.left_at && String(r.status || "active").toLowerCase() === "active");
  const playerIds = unique(playerRows.map((r) => r.player_id));
  const [{ data: guardians }, { data: playerUsers }] = playerIds.length ? await Promise.all([
    db.from("player_guardians").select("player_id, user_id").in("player_id", playerIds),
    db.from("player_users").select("player_id, user_id").in("player_id", playerIds),
  ]) : [{ data: [] }, { data: [] }];
  const usersByPlayer = new Map();
  for (const row of [...(guardians || []), ...(playerUsers || [])]) {
    usersByPlayer.set(row.player_id, unique([...(usersByPlayer.get(row.player_id) || []), row.user_id]));
  }

  const reminderJobs = (jobs || []).filter((job) => !(job.payload && typeof job.payload === "object" && job.payload.automation));
  const [{ data: notifications }, { data: dispatches }] = await Promise.all([
    db.from("notifications").select("user_id, event_id, event_type, source_notification_job_id, created_at").in("event_id", eventIds),
    db.from("notification_dispatch_log").select("user_id, event_id, reminder_key, channel, sent_at").in("event_id", eventIds),
  ]);
  const answeredStatuses = new Set(["yes", "no", "sick", "injured", "external_training"]);

  const output = matches.map((event) => {
    const eventAttendance = new Map((attendance || []).filter((a) => a.event_id === event.id).map((a) => [a.player_id, a.status]));
    const eventJobs = reminderJobs.filter((j) => j.event_id === event.id);
    const latestSent = eventJobs.find((j) => j.status === "sent") || null;
    const inboxUsers = new Set((notifications || []).filter((n) => n.source_notification_job_id === latestSent?.id).map((n) => n.user_id));
    const manualUsers = new Set((notifications || []).filter((n) => n.event_id === event.id && n.event_type === "manual_reminder_followup").map((n) => n.user_id));
    const pushUsers = new Set((dispatches || []).filter((d) => d.event_id === event.id && d.reminder_key === `job:${latestSent?.id}` && d.channel === "push").map((d) => d.user_id));
    const players = playerRows.map((r) => {
      const status = String(eventAttendance.get(r.player_id) || "").toLowerCase();
      const open = !answeredStatuses.has(status);
      const recipients = usersByPlayer.get(r.player_id) || [];
      return {
        id: r.player_id,
        name: [r.players?.first_name, r.players?.last_name].filter(Boolean).join(" ").trim() || "Spieler",
        open,
        recipientCount: recipients.length,
        inboxCount: recipients.filter((id) => inboxUsers.has(id)).length,
        pushCount: recipients.filter((id) => pushUsers.has(id)).length,
        manualCount: recipients.filter((id) => manualUsers.has(id)).length,
      };
    });
    return {
      ...event,
      latestReminder: latestSent ? { id: latestSent.id, sent_at: latestSent.sent_at, send_at: latestSent.send_at } : null,
      nextReminder: eventJobs.find((j) => j.status === "pending") || null,
      players,
    };
  });
  return res.status(200).json({ ok: true, matches: output });
}
