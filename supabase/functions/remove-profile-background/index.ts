import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EntityType = "player" | "staff";

type RequestBody = {
  entityType?: EntityType;
  entityId?: string;
  teamSeasonId?: string;
  sourceImageUrl?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeBackground(
  apiUrl: string,
  apiKey: string,
  sourceImageUrl: string,
  imageBytes: ArrayBuffer,
): Promise<{ ok: true; pngBytes: ArrayBuffer } | { ok: false; error: string }> {
  const tryRequest = async (body: FormData): Promise<Response> => {
    return fetch(apiUrl, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body,
    });
  };

  const urlForm = new FormData();
  urlForm.append("image_url", sourceImageUrl);
  urlForm.append("size", "auto");
  urlForm.append("format", "png");

  let res = await tryRequest(urlForm);

  if (!res.ok) {
    const fileForm = new FormData();
    fileForm.append("image_file", new Blob([imageBytes]), "source.jpg");
    fileForm.append("size", "auto");
    fileForm.append("format", "png");
    res = await tryRequest(fileForm);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { ok: false, error: detail || `Background API HTTP ${res.status}` };
  }

  return { ok: true, pngBytes: await res.arrayBuffer() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = (Deno.env.get("BACKGROUND_REMOVAL_API_KEY") ?? "").trim();
    const apiUrl = (Deno.env.get("BACKGROUND_REMOVAL_API_URL") ?? "").trim();

    if (!apiKey || !apiUrl) {
      return json({
        cutoutUrl: null,
        warning: "Background removal not configured (missing API env)",
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnon || !serviceRoleKey) {
      return json({ cutoutUrl: null, warning: "Supabase env incomplete" });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const entityType = body.entityType;
    const entityId = (body.entityId ?? "").trim();
    const teamSeasonId = (body.teamSeasonId ?? "").trim();
    const sourceImageUrl = (body.sourceImageUrl ?? "").trim();

    if (entityType !== "player" && entityType !== "staff") {
      return json({ error: "Invalid entityType" }, 400);
    }
    if (!entityId || !teamSeasonId || !sourceImageUrl) {
      return json({ error: "Missing entityId, teamSeasonId or sourceImageUrl" }, 400);
    }

    const { data: canManage, error: permError } = await userClient.rpc("can_manage_team_staff", {
      p_team_season_id: teamSeasonId,
    });

    if (permError || !canManage) {
      return json({ error: "Forbidden" }, 403);
    }

    const sourceRes = await fetch(sourceImageUrl);
    if (!sourceRes.ok) {
      return json({ cutoutUrl: null, warning: "Could not fetch source image" });
    }

    const sourceBytes = await sourceRes.arrayBuffer();
    const removed = await removeBackground(apiUrl, apiKey, sourceImageUrl, sourceBytes);

    if (!removed.ok) {
      return json({ cutoutUrl: null, warning: removed.error });
    }

    const bucket = entityType === "player" ? "player-avatars" : "team-photos";
    const storagePath = `${teamSeasonId}/cutouts/${entityType}-${entityId}.png`;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, removed.pngBytes, {
      upsert: true,
      contentType: "image/png",
    });

    if (uploadError) {
      return json({ cutoutUrl: null, warning: uploadError.message });
    }

    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(storagePath);
    const cutoutUrl = (publicData?.publicUrl ?? "").trim() || null;

    if (!cutoutUrl) {
      return json({ cutoutUrl: null, warning: "Could not resolve public cutout URL" });
    }

    return json({ cutoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[remove-profile-background]", message);
    return json({ cutoutUrl: null, warning: message });
  }
});
