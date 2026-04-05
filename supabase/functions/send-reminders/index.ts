import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_BATCH_LIMIT = 50;
const VIENNA_TZ = "Europe/Vienna";

type JobRow = {
  id: string;
  team_id: string | null;
  event_id: string | null;
  kind?: string | null;
  payload: Record<string, unknown> | null;
};

type EventRow = {
  id: string;
  team_season_id: string;
  starts_at: string | null;
  meeting_at?: string | null;
  status?: string | null;
  opponent?: string | null;
  notes?: string | null;
  match_id?: string | null;
};

function formatTimeDe(iso: string | null) {
  if (!iso) return "--:--";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: VIENNA_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

function formatDateShortDe(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-AT", {
      timeZone: VIENNA_TZ,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function reminderAppDeepLink(kind: string, event: EventRow): string {
  if (kind === "match" && event.match_id) return `/app/match/${event.match_id}`;
  if (kind === "match") return `/app/events/${event.id}`;
  return `/app/events/${event.id}`;
}

function buildReminderUxCopy(
  kind: string,
  event: EventRow,
  reminderKey: string | undefined,
): { title: string; message: string } {
  const meetOrStart =
    event.meeting_at && String(event.meeting_at).trim()
      ? event.meeting_at
      : event.starts_at;
  const timeStr = formatTimeDe(meetOrStart);
  if (kind === "match") {
    const opp = (event.opponent ?? "").trim();
    const gegner = opp || "Gegner";
    const title = `⚽ Spiel gegen ${gegner}`;
    const isSecond =
      reminderKey === "match_reminder_2" ||
      reminderKey === "match_second_reminder" ||
      (typeof reminderKey === "string" && reminderKey.includes("second"));
    const message = isSecond
      ? `Heute ${timeStr} – Gleich Treffpunkt`
      : `Heute ${timeStr} – Treffpunkt nicht vergessen`;
    return { title, message };
  }
  if (kind === "training") {
    return {
      title: "🏃 Training",
      message: `Heute ${timeStr} – Wir sehen uns am Platz`,
    };
  }
  const dateStr = formatDateShortDe(event.starts_at);
  const startTime = formatTimeDe(event.starts_at);
  return {
    title: "📅 Termin",
    message: `${dateStr} ${startTime} – Erinnerung`,
  };
}

async function completeJob(admin: any, id: string) {
  await admin.from("notification_jobs").update({
    status: "sent",
    sent_at: new Date().toISOString(),
  }).eq("id", id);
}

async function failJob(admin: any, id: string, error: string) {
  await admin.from("notification_jobs").update({
    status: "failed",
    last_error: error,
  }).eq("id", id);
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Jobs holen
    const { data: jobs } = await supabase
      .from("notification_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", now)
      .limit(JOB_BATCH_LIMIT);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }));
    }

    console.log("Jobs gefunden:", jobs.length);

    for (const job of jobs as JobRow[]) {
      try {
        // Event laden
        const { data: event } = await supabase
          .from("events")
          .select(
            "id, team_season_id, starts_at, meeting_at, opponent, notes, status, match_id",
          )
          .eq("id", job.event_id)
          .single();

        if (!event) throw new Error("Event nicht gefunden");

        if (event.status !== "upcoming") {
          await completeJob(supabase, job.id);
          continue;
        }

        // Empfänger holen
        const { data: members } = await supabase
          .from("memberships")
          .select("user_id")
          .eq("team_season_id", event.team_season_id);

        if (!members || members.length === 0) {
          await completeJob(supabase, job.id);
          continue;
        }

        // 🔥 WICHTIG: DEDUPE USER IDS
        const uniqueUserIds = [
          ...new Set(
            members
              .map((m) => m.user_id)
              .filter((id) => !!id)
          ),
        ];

        const jobKind = (job.kind as string) || "event";
        const p = job.payload && typeof job.payload === "object"
          ? (job.payload as Record<string, unknown>)
          : {};
        const reminderKey =
          typeof p.reminderKey === "string"
            ? p.reminderKey
            : typeof p.reminder_type === "string"
              ? p.reminder_type
              : undefined;
        const { title: uxTitle, message: uxMessage } = buildReminderUxCopy(
          jobKind,
          event as EventRow,
          reminderKey,
        );
        const linkPath = reminderAppDeepLink(jobKind, event as EventRow);

        // 🔥 WICHTIG: UPSERT + SOURCE JOB ID
        const rows = uniqueUserIds.map((userId) => ({
          user_id: userId,
          team_id: job.team_id,
          event_id: event.id,
          title: uxTitle,
          message: uxMessage,
          type: "auto",
          read: false,
          link: linkPath,
          source_notification_job_id: job.id,
        }));

        const { error } = await supabase
          .from("notifications")
          .upsert(rows, {
            onConflict: "source_notification_job_id,user_id",
          });

        if (error) throw error;

        console.log("Job erledigt:", job.id);

        await completeJob(supabase, job.id);

      } catch (err: any) {
        console.error("Job Fehler:", err.message);
        await failJob(supabase, job.id, err.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }));

  } catch (err: any) {
    console.error("FATAL:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
    });
  }
});