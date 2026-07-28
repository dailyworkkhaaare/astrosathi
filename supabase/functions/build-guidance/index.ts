import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const DEFAULT_TZ = "Asia/Kolkata"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Collapse to a single line: no newlines / tabs / 4+ spaces (WhatsApp param rule)
function oneLine(s: unknown): string {
  return String(s ?? "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\t/g, " ")
    .replace(/ {4,}/g, " ")
    .trim()
}

function localDateISO(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

function dateLabel(iso: string, tz: string): string {
  // e.g. "Monday, 27 July"
  const d = new Date(`${iso}T12:00:00Z`)
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d)
}

Deno.serve(async (req) => {
  try {
    const { user_id, lang: langIn, date: dateIn } = await req
      .json()
      .catch(() => ({}))
    if (!user_id) return json({ ok: false, reason: "missing_user_id" }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: prefs } = await supabase
      .from("whatsapp_prefs")
      .select("lang")
      .eq("user_id", user_id)
      .maybeSingle()

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone, display_name")
      .eq("user_id", user_id)
      .maybeSingle()

    const tz = profile?.timezone || DEFAULT_TZ
    const lang = langIn || prefs?.lang || "en"
    const date = dateIn || localDateISO(tz)

    const { data: birth } = await supabase
      .from("birth_profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .maybeSingle()

    const fullName = (birth?.full_name || profile?.display_name || "").trim()
    const firstName = fullName ? fullName.split(/\s+/)[0] : "there"

    const { data: h } = await supabase
      .from("daily_horoscopes")
      .select("summary, focus, lucky")
      .eq("user_id", user_id)
      .eq("horoscope_date", date)
      .eq("lang", lang)
      .maybeSingle()

    if (!h) return json({ ok: false, reason: "no_horoscope" })

    const lucky = (h.lucky || {}) as {
      color?: string
      number?: number | string
      direction?: string
    }
    const luckyStr = [lucky.color, lucky.number, lucky.direction]
      .filter((x) => x !== undefined && x !== null && String(x).length > 0)
      .join(" · ")

    // The 4 template variables, in order:
    const params = {
      name: oneLine(firstName),                                   // user://388d872b-594c-81b7-b763-0002c9da3bb4
      body: oneLine(`${dateLabel(date, tz)} — ${h.summary || ""}`), // 388d872b-594c-81b7-b763-0002c9da3bb4
      focus: oneLine(h.focus || ""),                              // thread://ce48f13c-80c4-819c-aab5-000362189a3e/3a98f13c-80c4-80c1-b90a-00a9d4c283b9
      lucky: oneLine(luckyStr),                                   // https://app.notion.com/p/5da647b3ea2943a5874ee7bbd0c321ba
    }

    // Backward-compatible single-line version (for free-form window sends)
    const message = oneLine(
      `🙏 Namaste ${params.name} ✨ ${params.body} 🎯 Focus: ${params.focus} 🍀 Lucky: ${params.lucky}`,
    )

    return json({ ok: true, params, message, lang, date })
  } catch (e) {
    return json({ ok: false, reason: "error", error: String(e) }, 500)
  }
})