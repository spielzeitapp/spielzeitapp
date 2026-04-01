import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const REMINDER_LINK = "/app/termine";
const JOB_BATCH_LIMIT = 50;
const VIENNA_TZ = "Europe/Vienna";

type JobRow = {
  id: string;
  team_id: string | null;
  event_id: string | null;
  kind: string | null;
  payload: any;
};

type EventRow = {
  id: string;
  team_season_id: string;
  starts_at: string | null;
  meeting_at?: string | null;
  status?: string | null;
  opponent?: string | null;
  notes?: string | null;
};

function formatVienna(iso: string | null) {
  if (!iso) return "unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: VIENNA_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function buildMessage(event: EventRow) {
  const time = formatVienna(event.starts_at);
  if (event.opponent) {
    return `Erinnerung: Spiel gegen ${event.opponent} um ${time}`;
  }
  return `Erinnerung: Termin um ${time}`;
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

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // 🔥 Jobs holen
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
        // 🔥 Event laden (OHNE meetup_at!)
        const { data: event } = await supabase
          .from("events")
          .select("id, team_season_id, starts_at, meeting_at, opponent, notes, status")
          .eq("id", job.event_id)
          .single();

        if (!event) throw new Error("Event nicht gefunden");

        // nur zukünftige Events
        if (event.status !== "upcoming") {
          await completeJob(supabase, job.id);
          continue;
        }

        // 🔥 Empfänger holen
        const { data: members } = await supabase
          .from("memberships")
          .select("user_id")
          .eq("team_season_id", event.team_season_id);

        if (!members || members.length === 0) {
          await completeJob(supabase, job.id);
          continue;
        }

        const message = buildMessage(event);

        // 🔥 Notifications schreiben
        for (const m of members) {
          await supabase.from("notifications").insert({
            user_id: m.user_id,
            team_id: job.team_id,
            event_id: event.id,
            title: "Erinnerung",
            message,
            type: "auto",
            read: false,
            link: REMINDER_LINK,
          });
        }

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