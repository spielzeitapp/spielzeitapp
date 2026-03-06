import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ADMIN_SETUP_CODE = Deno.env.get("ADMIN_SETUP_CODE") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), { status: 401 });
    }

    const body = await req.json();
    const { code, teamSeasonId } = body ?? {};

    if (!code || typeof code !== "string" || code.trim() !== ADMIN_SETUP_CODE) {
      return new Response(JSON.stringify({ error: "Invalid setup code" }), { status: 403 });
    }
    if (!teamSeasonId || typeof teamSeasonId !== "string") {
      return new Response(JSON.stringify({ error: "Missing teamSeasonId" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const userId = userData.user.id;
    const tsId = Number(teamSeasonId);
    if (!Number.isFinite(tsId)) {
      return new Response(JSON.stringify({ error: "Invalid teamSeasonId" }), { status: 400 });
    }

    // a) upsert user_roles: { user_id, role: "admin" }
    const { error: userRolesErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id" }
      );

    if (userRolesErr) {
      return new Response(
        JSON.stringify({ error: "user_roles: " + userRolesErr.message }),
        { status: 500 }
      );
    }

    // b) upsert memberships: { user_id, team_season_id, role: "admin" }
    const { error: membershipsErr } = await admin
      .from("memberships")
      .upsert(
        {
          user_id: userId,
          team_season_id: tsId,
          role: "admin",
        },
        { onConflict: "user_id,team_season_id" }
      );

    if (membershipsErr) {
      return new Response(
        JSON.stringify({ error: membershipsErr.message }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
