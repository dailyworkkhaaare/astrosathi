// Supabase Edge Function: speech-to-text
// On-demand proxy to Sarvam Saaras v3 STT. Holds SARVAM_API_KEY on the backend.
// Audio is streamed through in memory and NEVER stored anywhere.
//
// Accepts a JSON body { audio_base64, mime, language_code, mode? } (same
// reliable JSON path as text-to-speech). This avoids the flaky browser
// multipart/FormData handling in supabase.functions.invoke(). We decode the
// base64 here and build the multipart request to Sarvam server-side.
//
// MODEL/SCRIPT NOTES:
// - We use `saaras:v3` because its `mode` parameter controls the OUTPUT SCRIPT.
// - We default to mode "codemix": Indic words come back in their native script
//   (Hindi -> Devanagari, Marathi -> Devanagari) while English words stay in
//   English. It never translates.
//   * "transcribe" = everything in the spoken language's native script.
//   * "translit"  = romanized (Hinglish) -- deliberately NOT used.
//   * "translate" = English -- deliberately NOT used.

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") ?? "";
const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";
const SARVAM_STT_MODEL = "saaras:v3";
const DEFAULT_MODE = "codemix";
const ALLOWED_MODES = new Set([
  "transcribe",
  "translate",
  "verbatim",
  "translit",
  "codemix",
]);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  // Strip a data-URL prefix if the client accidentally included one.
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!SARVAM_API_KEY) {
    return json(500, { error: "SARVAM_API_KEY not configured" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const audioB64 = (body.audio_base64 as string | undefined) ?? "";
    if (!audioB64) {
      return json(400, { error: "Missing 'audio_base64'" });
    }
    const mime = (body.mime as string | undefined) || "audio/webm";
    const languageCode =
      (body.language_code as string | undefined)?.trim() || "unknown";
    const requestedMode = (body.mode as string | undefined)?.trim() || "";
    const mode = ALLOWED_MODES.has(requestedMode) ? requestedMode : DEFAULT_MODE;

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(audioB64);
    } catch {
      return json(400, { error: "Invalid base64 audio" });
    }
    if (bytes.length < 1024) {
      // Too little audio to be real speech (e.g. an empty/aborted recording).
      return json(200, { transcript: "", language_code: languageCode });
    }

    // Sarvam matches the content type EXACTLY: it allows "audio/webm" but
    // rejects "audio/webm;codecs=opus". Strip any codec/parameter suffix.
    const baseMime = mime.split(";")[0].trim() || "audio/webm";
    const file = new File([bytes], `audio.${extFromMime(baseMime)}`, {
      type: baseMime,
    });

    const outForm = new FormData();
    outForm.append("file", file);
    outForm.append("model", SARVAM_STT_MODEL);
    outForm.append("mode", mode);
    // language_code "unknown" => auto-detect; the mode controls the script.
    outForm.append("language_code", languageCode);

    const resp = await fetch(SARVAM_STT_URL, {
      method: "POST",
      headers: { "api-subscription-key": SARVAM_API_KEY },
      body: outForm,
    });

    const raw = await resp.text();
    if (!resp.ok) {
      console.error(`[speech-to-text] Sarvam ${resp.status}: ${raw}`);
      return json(resp.status, { error: "STT failed", detail: raw });
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json(502, { error: "Bad response from Sarvam", detail: raw });
    }

    const transcript = (data.transcript as string | undefined) ?? "";
    console.log(
      `[speech-to-text] ok model=${SARVAM_STT_MODEL} mode=${mode} lang=${
        (data.language_code as string | undefined) ?? languageCode
      } bytes=${bytes.length} chars=${transcript.length}`,
    );
    return json(200, {
      transcript,
      language_code: (data.language_code as string | undefined) ?? languageCode,
    });
  } catch (e) {
    console.error(`[speech-to-text] ${e}`);
    return json(500, { error: String(e) });
  }
});