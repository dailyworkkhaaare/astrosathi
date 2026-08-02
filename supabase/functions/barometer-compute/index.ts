// AstroSaathi Composite Financial Barometer
// Engine v1.0.1 — coverage-adjusted confidence
// z = intercept + Σ(weight × normalized); P(up) = sigmoid(z)
// Confidence = raw distance-from-half confidence × active-source coverage.
// Missing sources never stop the daily lock and cannot overstate confidence.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ENGINE = "Barometer-Core";
const VERSION = "1.0.1";
const IST = "Asia/Kolkata";
const MAX_WINDOW_DAYS = 400;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
function failure(message: string, status = 400): Response {
  return response({ ok: false, engine: ENGINE, version: VERSION, error: message }, status);
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}
function istDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function addDays(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function daySpan(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00Z").getTime() -
      new Date(from + "T00:00:00Z").getTime()) /
      86400000,
  );
}

const RIKTA = new Set([4, 9, 14, 19, 24, 29]);
function normalizePanchanga(paksha: string, tithi: number) {
  const pakshaScore = paksha === "shukla" ? 0.5 : -0.5;
  const tithiScore = RIKTA.has(tithi) ? -0.5 : 0.2;
  return {
    value: clamp(pakshaScore + tithiScore, -1, 1),
    detail: { paksha_score: pakshaScore, tithi_score: tithiScore },
  };
}
function normalizeBradley(current: number, history: number[]): number | null {
  if (!history.length) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance =
    history.reduce((sum, x) => sum + (x - mean) ** 2, 0) / history.length;
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : clamp((current - mean) / sd / 2, -1, 1);
}
function normalizeSbc(percentile: number): number {
  return clamp((percentile - 0.5) * 2, -1, 1);
}

type SourceConfig = {
  active: boolean;
  weight: number;
  normalization: string;
  description?: string;
};
type BarometerParams = {
  version: string;
  intercept: number;
  sources: Record<string, SourceConfig>;
  confidence: { mode: string; scale: number; clip: [number, number] };
  bias_thresholds: { bearish_at: number; bullish_at: number };
};

async function activeConfig(svc: any): Promise<BarometerParams> {
  const { data, error } = await svc
    .from("barometer_config")
    .select("params")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("read barometer_config: " + error.message);
  if (!data) throw new Error("no active barometer_config row");
  return data.params as BarometerParams;
}

async function computeDate(svc: any, params: BarometerParams, date: string) {
  const windowFrom = addDays(date, -60);

  const { data: bradleyRows, error: bradleyError } = await svc
    .from("bradley_siderograph_daily")
    .select("bradley_date,p_raw")
    .gte("bradley_date", windowFrom)
    .lte("bradley_date", date)
    .order("bradley_date", { ascending: true });
  if (bradleyError) throw new Error("read Bradley: " + bradleyError.message);
  const bradleyTarget = (bradleyRows ?? []).find((r: any) => r.bradley_date === date);
  const bradleyRaw = bradleyTarget ? Number(bradleyTarget.p_raw) : null;
  const bradleyNormalized =
    bradleyRaw === null
      ? null
      : normalizeBradley(
          bradleyRaw,
          (bradleyRows ?? []).map((r: any) => Number(r.p_raw)),
        );

  const { data: panchangaRow, error: panchangaError } = await svc
    .from("panchanga_daily")
    .select("panchanga_date,tithi,paksha")
    .eq("panchanga_date", date)
    .maybeSingle();
  if (panchangaError) throw new Error("read Panchanga: " + panchangaError.message);
  const panchanga = panchangaRow
    ? normalizePanchanga(String(panchangaRow.paksha), Number(panchangaRow.tithi))
    : null;

  const { data: assetRows, error: assetError } = await svc
    .from("sbc_asset_charts")
    .select("asset_key");
  if (assetError) throw new Error("read assets: " + assetError.message);
  const assets = (assetRows ?? []).map((r: any) => String(r.asset_key));
  if (!assets.length) throw new Error("no assets in sbc_asset_charts");

  const output: any[] = [];
  for (const assetKey of assets) {
    const { data: sbcRows, error: sbcError } = await svc
      .from("sbc_vedha_daily")
      .select("sbc_date,scored_data")
      .eq("asset_key", assetKey)
      .gte("sbc_date", windowFrom)
      .lte("sbc_date", date)
      .order("sbc_date", { ascending: true });
    if (sbcError) throw new Error(`read SBC ${assetKey}: ${sbcError.message}`);

    const sbcTarget = (sbcRows ?? []).find((r: any) => r.sbc_date === date);
    const sbcRaw = sbcTarget
      ? Number(sbcTarget.scored_data?.score_raw ?? 0)
      : null;
    let sbcPercentile: number | null = null;
    let sbcNormalized: number | null = null;
    if (sbcRaw !== null) {
      const scores = (sbcRows ?? []).map((r: any) =>
        Number(r.scored_data?.score_raw ?? 0),
      );
      const below = scores.filter((x: number) => x < sbcRaw).length;
      sbcPercentile = scores.length > 1 ? below / (scores.length - 1) : 0.5;
      sbcNormalized = normalizeSbc(clamp(sbcPercentile, 0, 1));
    }

    let z = Number(params.intercept ?? 0);
    const sources: Record<string, any> = {};
    const totalActiveWeight = Object.values(params.sources ?? {})
      .filter((cfg) => cfg?.active)
      .reduce((sum, cfg) => sum + Math.abs(Number(cfg?.weight ?? 0)), 0);
    let usedActiveWeight = 0;

    const include = (key: string, raw: unknown, normalized: number | null) => {
      const cfg = params.sources?.[key];
      const active = !!cfg?.active;
      const weight = Number(cfg?.weight ?? 0);
      const present = normalized !== null && Number.isFinite(normalized);
      const used = active && present;
      const contribution = used ? weight * (normalized as number) : 0;
      if (used) {
        z += contribution;
        usedActiveWeight += Math.abs(weight);
      }
      sources[key] = {
        raw,
        used,
        active,
        weight,
        present,
        normalized,
        contribution,
        normalization: cfg?.normalization ?? null,
      };
    };

    include("market_predict", null, null);
    include(
      "sbc",
      { score_raw: sbcRaw, percentile_60d: sbcPercentile },
      sbcNormalized,
    );
    include("bradley", { p_raw: bradleyRaw }, bradleyNormalized);
    include(
      "panchanga",
      panchangaRow
        ? {
            tithi: panchangaRow.tithi,
            paksha: panchangaRow.paksha,
            detail: panchanga?.detail ?? null,
          }
        : null,
      panchanga?.value ?? null,
    );
    include("dasha", null, null);

    const probability = sigmoid(z);
    const scale = Number(params.confidence?.scale ?? 200);
    const clip = params.confidence?.clip ?? [0, 100];
    const rawConfidence = clamp(
      Math.abs(probability - 0.5) * scale,
      clip[0],
      clip[1],
    );
    const sourceCoverage =
      totalActiveWeight > 0
        ? clamp(usedActiveWeight / totalActiveWeight, 0, 1)
        : 0;
    const adjustedConfidence = Math.round(rawConfidence * sourceCoverage);
    const bullishAt = Number(params.bias_thresholds?.bullish_at ?? 0.55);
    const bearishAt = Number(params.bias_thresholds?.bearish_at ?? 0.45);
    const bias =
      probability >= bullishAt
        ? "bullish"
        : probability <= bearishAt
          ? "bearish"
          : "neutral";

    output.push({
      barometer_date: date,
      asset_key: assetKey,
      inputs: {
        z,
        source_coverage: sourceCoverage,
        used_active_weight: usedActiveWeight,
        total_active_weight: totalActiveWeight,
        raw_confidence: rawConfidence,
        adjusted_confidence: adjustedConfidence,
        sources,
      },
      fused_probability: probability,
      confidence_score: adjustedConfidence,
      directional_bias: bias,
      config_version: params.version ?? "1.0.0",
      engine_version: VERSION,
      computed_at: new Date().toISOString(),
    });
  }

  const { error: writeError } = await svc
    .from("financial_barometer_daily")
    .upsert(output, { onConflict: "barometer_date,asset_key" });
  if (writeError)
    throw new Error("upsert financial_barometer_daily: " + writeError.message);
  return output;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const query = url.searchParams;
    const secret =
      Deno.env.get("BAROMETER_CRON_SECRET") || Deno.env.get("SBC_CRON_SECRET");
    if (secret) {
      const provided = query.get("secret") || req.headers.get("x-cron-secret") || "";
      if (provided !== secret) return failure("bad or missing secret", 401);
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey)
      return failure("missing SUPABASE_URL / SERVICE_ROLE_KEY env", 500);
    const svc = createClient(supabaseUrl, serviceKey);
    const mode = (query.get("mode") || "daily").toLowerCase();

    if (mode === "diag") {
      const config = await activeConfig(svc).catch((e: any) => ({
        error: String(e?.message ?? e),
      }));
      return response({
        ok: true,
        engine: ENGINE,
        version: VERSION,
        mode,
        today_ist: istDateStr(),
        env: {
          has_url: !!supabaseUrl,
          has_key: !!serviceKey,
          has_secret: !!secret,
        },
        active_config: config,
      });
    }

    const params = await activeConfig(svc);
    if (mode === "backfill") {
      const from = query.get("from");
      const to = query.get("to") || istDateStr();
      if (!from) return failure("backfill requires ?from=YYYY-MM-DD (&to optional)");
      const span = daySpan(from, to);
      if (span < 0) return failure("from must be <= to");
      if (span + 1 > MAX_WINDOW_DAYS)
        return failure(`window too large: ${span + 1} days > ${MAX_WINDOW_DAYS}`);
      const started = Date.now();
      let daysProcessed = 0;
      const errors: string[] = [];
      for (let d = from; daySpan(d, to) >= 0; d = addDays(d, 1)) {
        try {
          await computeDate(svc, params, d);
          daysProcessed++;
        } catch (e: any) {
          errors.push(`${d}: ${String(e?.message ?? e)}`);
        }
      }
      return response({
        ok: errors.length === 0,
        engine: ENGINE,
        version: VERSION,
        mode,
        window_from: from,
        window_to: to,
        days_processed: daysProcessed,
        errors: errors.length ? errors : undefined,
        elapsed_ms: Date.now() - started,
      });
    }

    const date = query.get("date") || istDateStr();
    const rows = await computeDate(svc, params, date);
    return response({
      ok: true,
      engine: ENGINE,
      version: VERSION,
      mode: "daily",
      date,
      rows_written: rows.length,
      summary: rows.map((row: any) => ({
        asset_key: row.asset_key,
        p: Number(row.fused_probability.toFixed(4)),
        confidence: row.confidence_score,
        coverage: Number(row.inputs.source_coverage.toFixed(4)),
        bias: row.directional_bias,
      })),
    });
  } catch (e: any) {
    return failure(String(e?.message ?? e), 500);
  }
});
