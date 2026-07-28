// supabase/functions/whatsapp-send/index.ts
// Sends the daily_guidance WhatsApp template to a single opted-in user.
// Deploy with verify_jwt OFF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!

const GRAPH_VERSION = "v21.0"
const TEMPLATE_NAME = "daily_guidance"
const TEMPLATE_LANG = "en"

// WhatsApp rejects template variable text that contains new-line / tab
// characters or 4+ consecutive spaces (error #132018). Collapse to a single
// clean line so the currently-approved template accepts it.
function sanitizeParam(s: string): string {
  return s
    .replace(/\s*\n\s*/g, " ") // newlines (and surrounding spaces) -> single space
    .replace(/\t/g, " ")        // tabs -> space
    .replace(/ {4,}/g, " ")     // never 4+ consecutive spaces
    .trim()
}

// Returns today's date as YYYY-MM-DD in the given IANA timezone.
function localDateISO(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ ok: false, reason: "method_not_allowed" }, 405)
    }

    const { user_id } = await req.json().catch(() => ({}))
    if (!user_id) {
      return json({ ok: false, reason: "missing_user_id" }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // 1) Load the user's WhatsApp preferences.
    const { data: prefs, error: prefsErr } = await supabase
      .from("whatsapp_prefs")
      .select("phone_e164, opt_in, lang")
      .eq("user_id", user_id)
      .maybeSingle()

    if (prefsErr) {
      return json({ ok: false, reason: "prefs_error", detail: prefsErr.message }, 500)
    }
    if (!prefs || !prefs.opt_in) {
      return json({ ok: false, reason: "not_opted_in" }, 200)
    }
    if (!prefs.phone_e164) {
      return json({ ok: false, reason: "no_phone" }, 200)
    }

    const lang = prefs.lang || "en"

    // 2) Build the guidance message (reuses the build-guidance function).
    const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-guidance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ user_id, lang }),
    })
    const build = await buildRes.json().catch(() => ({}))
    if (!build?.ok || !build?.message) {
      return json({ ok: false, reason: "no_message", detail: build?.reason ?? null }, 200)
    }

    // 3) Sanitize for the template variable and send.
    const paramText = sanitizeParam(String(build.message))
    const to = prefs.phone_e164.replace(/^\+/, "") // Graph API wants no leading "+"

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: paramText }],
          },
          // Static-URL button ("Visit website") needs NO component here.
        ],
      },
    }

    const sendRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify(payload),
      },
    )
    const sendBody = await sendRes.json().catch(() => ({}))

    if (!sendRes.ok) {
      return json({ ok: false, status: sendRes.status, error: sendBody?.error ?? sendBody }, 200)
    }

    const waMessageId = sendBody?.messages?.[0]?.id ?? null

    // 4) Stamp last_sent_date (today in the user's timezone).
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("user_id", user_id)
      .maybeSingle()

    const tz = profile?.timezone || "Asia/Kolkata"
    await supabase
      .from("whatsapp_prefs")
      .update({ last_sent_date: localDateISO(tz) })
      .eq("user_id", user_id)

    return json({ ok: true, wa_message_id: waMessageId })
  } catch (e) {
    return json({ ok: false, reason: "exception", detail: String(e) }, 500)
  }
})