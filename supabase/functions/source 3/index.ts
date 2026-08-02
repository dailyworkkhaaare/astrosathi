// Supabase Edge Function: proactive-dispatch
// -----------------------------------------------------------------------------
// CI-4.3 · Proactive Companion (Layer 12) delivery — IN-APP ONLY (v1).
// A cron-scheduled dispatcher that releases the `pending` nudges written by
// proactive-nudges (CI-4.2), respecting each user's quiet hours and weekly cap,
// then flips them to `sent`. "Delivery" for in-app means marking a nudge `sent`
// so the CI-4.4 feed surfaces it; pending nudges stay hidden until released, so
// quiet-hours + cap gating actually controls what the user sees.
//
// WhatsApp is intentionally NOT handled here yet (a separate, later step, since
// it needs an approved Meta template). Channel routing will be added then.
//
// AuthZ: cron/service via x-cron-secret (== PROACTIVE_CRON_SECRET) dispatches
// all users; otherwise a caller JWT dispatches only that user. Service-role DB
// access throughout; the user_proactive_nudges lifecycle is server-owned.
//
// Request:  POST { user_id?, dry_run?, ignore_quiet_hours?, limit?=500 }
// Response: 200 { ok, users, delivered, skipped_quiet, skipped_capped,
//                 dry_run, preview? }

// @ts-ignore - esm.sh import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}
function err(status: number, code: string, message?: string): Response {
  return json(status, { error: { code, message: message ?? code } });
}

// Current wall-clock hour (0..23) in an IANA timezone.
function hourInTz(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(new Date());
    let h = parseInt(s, 10);
    if (!Number.isFinite(h)) return -1;
    if (h === 24) h = 0;
    return h;
  } catch {
    return -1;
  }
}

// Quiet-hours window may wrap midnight (e.g. start=22, end=7).
function inQuietHours(
  hour: number,
  start: number | null,
  end: number | null,
): boolean {
  if (hour < 0 || start == null || end == null) return false;
  if (start === end) return false; // empty window
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps midnight
}

type NudgeRow = {
  id: string;
  user_id: string;
  kind: string;
  priority: string;
};

const PRIORITY_RANK: Record<string, number> = { high: 3, normal: 2, low: 1 };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "Only POST is supported");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }

  let body: {
    user_id?: string;
    dry_run?: boolean;
    ignore_quiet_hours?: boolean;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ---- Auth: cron/service (x-cron-secret) OR a single logged-in user ----
  const cronSecret = Deno.env.get("PROACTIVE_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret") || "";
  const isCron = !!cronSecret && providedSecret === cronSecret;

  let restrictUserId: string | null = null;
  if (isCron) {
    restrictUserId = body.user_id ? String(body.user_id).trim() : null;
  } else {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return err(
        401,
        "unauthorized",
        "A valid session or cron secret is required",
      );
    }
    restrictUserId = user.id;
  }

  const dryRun = body.dry_run === true;
  const ignoreQuiet = body.ignore_quiet_hours === true;
  const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 2000);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const sevenDaysAgoIso = new Date(nowMs - 7 * 86400 * 1000).toISOString();

  // 1) Load due pending nudges (optionally for one user).
  let dueQuery = svc
    .from("user_proactive_nudges")
    .select("id, user_id, kind, priority")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("user_id", { ascending: true })
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (restrictUserId) dueQuery = dueQuery.eq("user_id", restrictUserId);
  const { data: dueRows, error: dueErr } = await dueQuery;
  if (dueErr) return err(500, "read_failed", dueErr.message);

  // Group by user.
  const byUser = new Map<string, NudgeRow[]>();
  for (const r of (dueRows ?? []) as NudgeRow[]) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  let users = 0;
  let delivered = 0;
  let skippedQuiet = 0;
  let skippedCapped = 0;
  const preview: any[] = [];

  for (const [uid, nudges] of byUser) {
    users++;

    // Settings (defaults: enabled, 3/week, no quiet hours).
    const { data: setRow } = await svc
      .from("user_proactive_settings")
      .select("enabled, max_per_week, quiet_hours_start, quiet_hours_end")
      .eq("user_id", uid)
      .maybeSingle();
    const enabled = setRow ? (setRow as any).enabled !== false : true;
    if (!enabled) {
      continue; // opted out; leave pending nudges untouched
    }
    const maxPerWeek = Number.isFinite(Number((setRow as any)?.max_per_week))
      ? Number((setRow as any).max_per_week)
      : 3;
    const rawStart = (setRow as any)?.quiet_hours_start;
    const rawEnd = (setRow as any)?.quiet_hours_end;
    const qStart = rawStart == null ? null : Number(rawStart);
    const qEnd = rawEnd == null ? null : Number(rawEnd);

    // Timezone for quiet-hours (profiles.timezone -> birth_timezone -> IST).
    const { data: profile } = await svc
      .from("profiles")
      .select("timezone")
      .eq("user_id", uid)
      .maybeSingle();
    let tz = (profile as any)?.timezone as string | null;
    if (!tz) {
      const { data: birth } = await svc
        .from("birth_profiles")
        .select("birth_timezone")
        .eq("user_id", uid)
        .maybeSingle();
      tz = ((birth as any)?.birth_timezone as string | null) ?? "Asia/Kolkata";
    }

    // Quiet hours -> defer everyone for this user this run.
    if (!ignoreQuiet && inQuietHours(hourInTz(tz), qStart, qEnd)) {
      skippedQuiet += nudges.length;
      continue;
    }

    // Weekly delivered cap (sent/acted/dismissed in the last 7 days).
    const { count: recentCount } = await svc
      .from("user_proactive_nudges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("status", ["sent", "acted", "dismissed"])
      .gte("sent_at", sevenDaysAgoIso);
    let available = Math.max(0, maxPerWeek - (recentCount ?? 0));
    if (available <= 0) {
      skippedCapped += nudges.length;
      continue;
    }

    // Highest priority first.
    const ordered = [...nudges].sort(
      (a, b) =>
        (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
    );

    for (const n of ordered) {
      if (available <= 0) {
        skippedCapped++;
        continue;
      }

      if (dryRun) {
        preview.push({ id: n.id, user_id: uid, kind: n.kind });
        delivered++;
        available--;
        continue;
      }

      // Guarded with status='pending' so a nudge can never be double-sent.
      const { error: upErr } = await svc
        .from("user_proactive_nudges")
        .update({
          status: "sent",
          channel: "in_app",
          sent_at: new Date().toISOString(),
        })
        .eq("id", n.id)
        .eq("user_id", uid)
        .eq("status", "pending");
      if (upErr) continue;

      delivered++;
      available--;
    }
  }

  return json(200, {
    ok: true,
    users,
    delivered,
    skipped_quiet: skippedQuiet,
    skipped_capped: skippedCapped,
    dry_run: dryRun,
    ...(dryRun ? { preview } : {}),
  });
});
