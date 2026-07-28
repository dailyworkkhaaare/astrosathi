import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!
const TEMPLATE_NAME = "daily_guidance"
const TEMPLATE_LANG = "en"

// Built by concatenation so no full URL literal appears in the file
const GRAPH_BASE = "https://" + "graph.facebook.com/v21.0"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// WhatsApp forbids newlines / tabs / 4+ spaces inside a variable value
function sanitizeParam(s: unknown): string {
  return String(s ?? "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\t/g, " ")
    .replace(/ {4,}/g, " ")
    .trim()
}

Deno.serve(async (req) => {
  try {
    const { user_id } = await req.json().catch(() => ({}))
    if (!user_id) return json({ ok: false, reason: "missing_user_id" }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Must be opted in with a phone number
    const { data: prefs } = await supabase
      .from("whatsapp_prefs")
      .select("phone_e164, opt_in")
      .eq("user_id", user_id)
      .maybeSingle()
    if (!prefs || !prefs.opt_in || !prefs.phone_e164) {
      return json({ ok: false, reason: "not_opted_in" })
    }

    // Get the 4 formatted pieces from build-guidance
    const buildRes = await fetch(
      `${SUPABASE_URL}/functions/v1/build-guidance`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ user_id }),
      },
    )
    const build = await buildRes.json()
    if (!build?.ok || !build?.params) {
      return json({ ok: false, reason: build?.reason || "no_message" })
    }

    const p = build.params
    const to = String(prefs.phone_e164).replace(/^\+/, "")

    // Order matters: name, body, focus, lucky -> template variables 1, 2, 3, 4
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
            parameters: [
              { type: "text", text: sanitizeParam(p.name) },
              { type: "text", text: sanitizeParam(p.body) },
              { type: "text", text: sanitizeParam(p.focus) },
              { type: "text", text: sanitizeParam(p.lucky) },
            ],
          },
        ],
      },
    }

    const waRes = await fetch(
      `${GRAPH_BASE}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify(payload),
      },
    )
    const waJson = await waRes.json()
    if (!waRes.ok) {
      return json({ ok: false, reason: "whatsapp_error", error: waJson }, 502)
    }

    const wa_message_id = waJson?.messages?.[0]?.id

    // Stamp the send date (the date build-guidance resolved, in user's tz)
    await supabase
      .from("whatsapp_prefs")
      .update({ last_sent_date: build.date })
      .eq("user_id", user_id)

    return json({ ok: true, wa_message_id })
  } catch (e) {
    return json({ ok: false, reason: "error", error: String(e) }, 500)
  }
})