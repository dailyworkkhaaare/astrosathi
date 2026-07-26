// Supabase Edge Function: build-guidance
// Composes a short, calm WhatsApp message from an already-cached
// public.daily_horoscopes row for a given user. Pure formatting — this
// function does NOT call any LLM/astrology provider and does NOT send
// anything; it is meant to be called by a WhatsApp-sending job (cron or
// otherwise) which POSTs a user_id and receives back the message text.
//
// Runtime: Deno (Supabase Edge Functions). Deploy with verify_jwt = false
// (this is a system/service call, not an end-user-authenticated one) —
// same posture as transit-planets-refresh.
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Secrets optional: BUILD_GUIDANCE_CRON_SECRET — if set, callers must send
//   a matching `x-cron-secret` header (same guard pattern as
//   transit-planets-refresh's TRANSIT_CRON_SECRET).

// @ts-ignore - esm.sh import (resolved at deploy time)
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
function fail(status: number, reason: string): Response {
  return json(status, { ok: false, reason });
}

// ---------- Language ----------
type Lang = "en" | "hi" | "mr";
const SUPPORTED_LANGS: Lang[] = ["en", "hi", "mr"];
function normalizeLang(raw: unknown): Lang | null {
  const s = String(raw ?? "").trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as string[]).includes(s) ? (s as Lang) : null;
}

const LOCALE_MAP: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

// Only the WhatsApp-message chrome is localized here — horoscope content
// (summary/focus/lucky) is already localized at generation time by the
// daily-horoscope function, one row per (user, date, lang).
const LABELS: Record<Lang, { focus: string; lucky: string; fallbackName: string }> = {
  en: { focus: "Focus", lucky: "Lucky", fallbackName: "friend" },
  hi: { focus: "फोकस", lucky: "शुभ", fallbackName: "मित्र" },
  mr: { focus: "फोकस", lucky: "शुभ", fallbackName: "मित्र" },
};

const DEFAULT_TZ = "Asia/Kolkata";

// ---------- Small helpers ----------
function firstName(full: unknown): string {
  return String(full ?? "").trim().split(/\s+/)[0] || "";
}

function todayIsoInTz(tz: string): string {
  // en-CA gives YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Formats a plain YYYY-MM-DD (no time component) as a long localized date,
// pinned to UTC so the calendar day shown never drifts with runtime tz.
function formatLongDate(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dt);
}

// jsonb { color, number, direction } -> "Blue · 7 · East", omitting any
// field that isn't present. Returns null if nothing usable is present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatLucky(lucky: any): string | null {
  if (!lucky || typeof lucky !== "object") return null;
  const parts = [lucky.color, lucky.number, lucky.direction]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter((v) => v.length > 0);
  return parts.length ? parts.join(" · ") : null;
}

const MESSAGE_CHAR_LIMIT = 700;

function buildMessage(args: {
  name: string;
  localizedDate: string;
  summary: string | null;
  focus: string | null;
  luckyStr: string | null;
  labels: { focus: string; lucky: string };
}): string {
  const { name, localizedDate, summary, focus, luckyStr, labels } = args;

  const header = `🙏 *Namaste ${name}*`;
  const dateLine = `✨ ${localizedDate} — your AstroSaathi guidance`;
  const focusLine = focus ? `🎯 *${labels.focus}:* ${focus}` : null;
  const luckyLine = luckyStr ? `🍀 *${labels.lucky}:* ${luckyStr}` : null;
  const footer = "🕉️ AstroSaathi";

  // Fit the summary within MESSAGE_CHAR_LIMIT: compute the fixed overhead
  // (every other line + the newline that will separate it from the body),
  // then truncate only the summary if the total would run over.
  const fixedLines = [header, dateLine, focusLine, luckyLine, footer].filter(
    (l): l is string => l !== null,
  );
  const overhead = fixedLines.reduce((n, l) => n + l.length + 1, 0);
  const maxBody = Math.max(0, MESSAGE_CHAR_LIMIT - overhead);

  let body = (summary ?? "").trim();
  if (body.length > maxBody) {
    body = body.slice(0, Math.max(0, maxBody - 1)).trimEnd() + "…";
  }

  const lines = [header, dateLine];
  if (body) lines.push(body);
  if (focusLine) lines.push(focusLine);
  if (luckyLine) lines.push(luckyLine);
  lines.push(footer);
  return lines.join("\n");
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return fail(500, "server_misconfigured");

  // Optional shared-secret guard, same posture as transit-planets-refresh —
  // only enforced when the secret is actually configured.
  const cronSecret = Deno.env.get("BUILD_GUIDANCE_CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret") || "";
    if (provided !== cronSecret) return fail(401, "bad_cron_secret");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) return fail(400, "missing_user_id");

  const inputLang = normalizeLang(body.lang);
  const inputDate =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: birth }, { data: profile }, { data: waPrefs }] = await Promise.all([
    svc.from("birth_profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    svc.from("profiles").select("display_name, timezone").eq("user_id", userId).maybeSingle(),
    svc.from("whatsapp_prefs").select("lang").eq("user_id", userId).maybeSingle(),
  ]);

  const lang: Lang = inputLang ?? normalizeLang(waPrefs?.lang) ?? "en";
  const labels = LABELS[lang];

  const tz = profile?.timezone || DEFAULT_TZ;
  const date = inputDate ?? todayIsoInTz(tz);

  const name = firstName(birth?.full_name) || firstName(profile?.display_name) || labels.fallbackName;

  // Exact (user, date, lang) match first.
  const { data: exact } = await svc
    .from("daily_horoscopes")
    .select("horoscope_date, summary, focus, lucky")
    .eq("user_id", userId)
    .eq("horoscope_date", date)
    .eq("lang", lang)
    .maybeSingle();

  let row = exact ?? null;

  // Fall back to the most recent cached reading for this user+lang.
  if (!row) {
    const { data: latest } = await svc
      .from("daily_horoscopes")
      .select("horoscope_date, summary, focus, lucky")
      .eq("user_id", userId)
      .eq("lang", lang)
      .order("horoscope_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = latest ?? null;
  }

  if (!row) return fail(404, "no_horoscope");

  const resolvedDate = String(row.horoscope_date);
  const localizedDate = formatLongDate(resolvedDate, LOCALE_MAP[lang]);
  const summary = typeof row.summary === "string" ? row.summary.trim() : null;
  const focus = typeof row.focus === "string" && row.focus.trim() ? row.focus.trim() : null;
  const luckyStr = formatLucky(row.lucky);

  const message = buildMessage({ name, localizedDate, summary, focus, luckyStr, labels });

  return json(200, { ok: true, message, lang, date: resolvedDate });
});
