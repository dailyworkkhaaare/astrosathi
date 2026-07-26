// supabase/functions/whatsapp-send/index.ts
// Sends the daily AstroSaathi guidance to a user via WhatsApp Cloud API.
// Internal-only (verify_jwt = OFF). Invoke: POST { "user_id": "<uuid>" }
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN            permanent Cloud API token
//   WHATSAPP_PHONE_NUMBER_ID  from WhatsApp API Setup
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Optional:
//   BUILD_GUIDANCE_CRON_SECRET  if set, callers must send matching x-cron-secret

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const GRAPH_VERSION = "v21.0"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!
const CRON_SECRET = Deno.env.get("BUILD_GUIDANCE_CRON_SECRET") ?? ""

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

// YYYY-MM-DD in the given IANA timezone
const todayInTz = (tz: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405)

  // Optional shared-secret guard (inert unless the secret is configured)
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401)
  }

  let user_id: string | undefined
  try {
    user_id = (await req.json())?.user_id
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400)
  }
  if (!user_id) return json({ ok: false, error: "user_id required" }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Read prefs
  const { data: prefs, error: prefsErr } = await supabase
    .from("whatsapp_prefs")
    .select("phone_e164, opt_in, lang")
    .eq("user_id", user_id)
    .maybeSingle()
  if (prefsErr) return json({ ok: false, error: prefsErr.message }, 500)
  if (!prefs || !prefs.opt_in || !prefs.phone_e164) {
    return json({ ok: false, reason: "not_opted_in" })
  }

  // 2. Build the localized message
  const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-guidance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {}),
    },
    body: JSON.stringify({ user_id, lang: prefs.lang }),
  })
  const build = await buildRes.json().catch(() => null)
  if (!build?.ok || !build?.message) {
    return json({ ok: false, reason: "no_message", detail: build })
  }

  // 3. Send the approved template (static URL button needs no component)
  const to = prefs.phone_e164.replace(/^\+/, "")
  const waRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "daily_guidance",
          language: { code: "en" }, // template is English; user://388d872b-594c-81b7-b763-0002c9da3bb4 carries localized text
          components: [
            { type: "body", parameters: [{ type: "text", text: build.message }] },
          ],
        },
      }),
    },
  )
  const waBody = await waRes.json().catch(() => null)
  if (!waRes.ok) {
    return json({ ok: false, status: waRes.status, error: waBody?.error ?? waBody }, 502)
  }

  // 4. Guard against double-sends today
  const { data: prof } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user_id)
    .maybeSingle()
  await supabase
    .from("whatsapp_prefs")
    .update({ last_sent_date: todayInTz(prof?.timezone || "Asia/Kolkata") })
    .eq("user_id", user_id)

  return json({ ok: true, wa_message_id: waBody?.messages?.[0]?.id ?? null })
})