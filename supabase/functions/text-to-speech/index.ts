// Supabase Edge Function: text-to-speech
// On-demand proxy to Sarvam Bulbul v3 TTS. Holds SARVAM_API_KEY on the backend.
// Only runs when the user taps the speaker icon. Audio is returned to the
// browser and NEVER stored anywhere.
//
// Long replies are auto-split at sentence boundaries into multiple clips so the
// WHOLE message is read aloud (never cut mid-sentence). The frontend plays the
// returned clips back-to-back. Output is MP3 to keep payloads small.

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") ?? "";
const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

// bulbul:v3 hard cap is 2500 chars/request; we chunk safely below it.
const CHUNK_CHARS = 1400;
// Safety ceiling so a runaway-long reply can't burn huge credits in one tap.
// ~12 chunks ~= 16k characters, far beyond any normal chat answer.
const MAX_CHUNKS = 12;

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

// Split text into <=maxLen chunks, preferring sentence boundaries
// (Devanagari danda ।, plus . ! ? and newlines).
function chunkText(text: string, maxLen: number): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean ? [clean] : [];

  const sentences = clean.split(/(?<=[।.!?\n])\s+/);
  const chunks: string[] = [];
  let cur = "";

  for (const s of sentences) {
    if (s.length > maxLen) {
      // A single sentence longer than the cap: flush, then hard-split it.
      if (cur.trim()) {
        chunks.push(cur.trim());
        cur = "";
      }
      for (let i = 0; i < s.length; i += maxLen) {
        chunks.push(s.slice(i, i + maxLen));
      }
      continue;
    }
    const candidate = cur ? `${cur} ${s}` : s;
    if (candidate.length > maxLen) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = s;
    } else {
      cur = candidate;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function synthesize(
  chunk: string,
  languageCode: string,
  speaker: string,
  pace: number,
): Promise<
  { ok: true; audio: string } | { ok: false; status: number; detail: string }
> {
  const payload = {
    text: chunk,
    language_code: languageCode,
    speaker,
    model: "bulbul:v3",
    pace,
    output_audio_codec: "mp3",
  };

  const resp = await fetch(SARVAM_TTS_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": SARVAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    return { ok: false, status: resp.status, detail: raw };
  }
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 502, detail: raw };
  }
  const audios = data.audios as string[] | undefined;
  const audio = Array.isArray(audios) ? audios[0] : null;
  if (!audio) {
    return { ok: false, status: 502, detail: raw };
  }
  return { ok: true, audio };
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
    const text = ((body.text as string | undefined) ?? "").trim();
    if (!text) {
      return json(400, { error: "Missing 'text'" });
    }

    const languageCode = (body.language_code as string | undefined) || "hi-IN";
    const speaker = (body.speaker as string | undefined) || "shubh";
    const pace =
      typeof body.pace === "number" && body.pace >= 0.5 && body.pace <= 2.0
        ? body.pace
        : 1.0;

    let chunks = chunkText(text, CHUNK_CHARS);
    let truncated = false;
    if (chunks.length > MAX_CHUNKS) {
      chunks = chunks.slice(0, MAX_CHUNKS);
      truncated = true;
    }

    // Synthesize each chunk sequentially and return all clips in order.
    const audios: string[] = [];
    for (const chunk of chunks) {
      const result = await synthesize(chunk, languageCode, speaker, pace);
      if (!result.ok) {
        console.error(
          `[text-to-speech] Sarvam ${result.status}: ${result.detail}`,
        );
        // If some clips already succeeded, return them so playback still works.
        if (audios.length > 0) break;
        return json(result.status, {
          error: "TTS failed",
          detail: result.detail,
        });
      }
      audios.push(result.audio);
    }

    if (audios.length === 0) {
      return json(502, { error: "No audio returned" });
    }

    console.log(
      `[text-to-speech] ok lang=${languageCode} speaker=${speaker} clips=${audios.length} truncated=${truncated}`,
    );
    return json(200, { audios, mime: "audio/mpeg", truncated });
  } catch (e) {
    console.error(`[text-to-speech] ${e}`);
    return json(500, { error: String(e) });
  }
});