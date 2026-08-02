// market-ohlc-refresh — Daily OHLC price spine from Yahoo Finance.
// Fetches: NIFTY 50 (^NSEI), NIFTY Bank (^NSEBANK), Gold spot USD (XAUUSD=X),
//          Silver spot USD (XAGUSD=X), USD-INR (INR=X), Bitcoin (BTC-USD).
// Idempotent: upsert on (trade_date, symbol). Per-symbol error isolation.
// Cultural / educational feature; not investment advice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const err = (m: string, s = 400, extra: Record<string, unknown> = {}) =>
  json({ ok: false, error: m, ...extra }, s);

// -----------------------------------------------------------
// Symbol catalog. `key` is the row identifier in market_ohlc.
// -----------------------------------------------------------
type SymbolCfg = { key: string; yahoo: string; description: string };
const SYMBOLS: SymbolCfg[] = [
  { key: "NIFTY50",   yahoo: "^NSEI",     description: "NIFTY 50 Index (NSE India)" },
  { key: "NIFTYBANK", yahoo: "^NSEBANK",  description: "NIFTY Bank Index (NSE India)" },
  { key: "GCUSD",     yahoo: "GC=F",      description: "Gold COMEX front-month futures USD/oz" },
  { key: "SIUSD",     yahoo: "SI=F",      description: "Silver COMEX front-month futures USD/oz" },
  { key: "USDINR",    yahoo: "INR=X",     description: "USD-INR foreign exchange rate" },
  { key: "BTCUSD",    yahoo: "BTC-USD",   description: "Bitcoin USD" },
];

// -----------------------------------------------------------
// Yahoo Finance daily bar fetcher
// -----------------------------------------------------------
type Bar = {
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

async function fetchYahooDaily(yahooSymbol: string, days: number): Promise<{ bars: Bar[]; meta?: unknown }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const pastSec = nowSec - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${pastSec}&period2=${nowSec}&interval=1d&includePrePost=false&events=div%7Csplit`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AstroSaathi/1.0; +https://astrosathi.vercel.app)",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status} for ${yahooSymbol}`);
  }

  const j = await res.json();
  const chartErr = j?.chart?.error;
  if (chartErr) throw new Error(`Yahoo chart error: ${JSON.stringify(chartErr)}`);

  const result = j?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo empty result for ${yahooSymbol}`);

  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q) throw new Error(`Yahoo missing quote block for ${yahooSymbol}`);

  // gmtoffset is the exchange's offset from UTC in seconds; use it to bucket
  // each bar into its local calendar date.
  const gmtOffset: number = result.meta?.gmtoffset ?? 0;

  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close?.[i];
    if (close == null || !isFinite(close)) continue; // skip stub / halted-day bars
    const localMs = (ts[i] + gmtOffset) * 1000;
    const trade_date = new Date(localMs).toISOString().slice(0, 10);
    bars.push({
      trade_date,
      open:   q.open?.[i]   ?? null,
      high:   q.high?.[i]   ?? null,
      low:    q.low?.[i]    ?? null,
      close:  Number(close),
      volume: q.volume?.[i] ?? null,
    });
  }
  // Dedup by trade_date (last-wins). Yahoo occasionally emits >1 bar per day
  // for FX pairs after session rollovers; Postgres upserts reject same-batch dupes.
  const dedupMap = new Map<string, Bar>();
  for (const b of bars) dedupMap.set(b.trade_date, b);
  const dedupedBars = Array.from(dedupMap.values());

  return { bars: dedupedBars, meta: { gmtOffset, exchangeTimezoneName: result.meta?.exchangeTimezoneName } };
}

// -----------------------------------------------------------
// Handler
// -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Use POST", 405);

  const URL_ = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!URL_ || !KEY) return err("Missing Supabase env", 500);

  // Reuse MARKET_CRON_SECRET (same as market-predict).
  const secret = Deno.env.get("MARKET_CRON_SECRET");
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) {
    return err("Bad or missing x-cron-secret", 401);
  }

  // Parse body
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const rawBackfill = Number(body?.backfill_days);
  const backfillDays = Number.isFinite(rawBackfill) && rawBackfill > 0
    ? Math.min(3650, Math.floor(rawBackfill))
    : 10; // default: 10-day rolling window (covers weekends + missed cron)
  const onlySymbols: string[] | null = Array.isArray(body?.symbols) && body.symbols.length
    ? body.symbols.map((s: unknown) => String(s))
    : null;

  const svc = createClient(URL_, KEY);

  // Fetch + upsert per symbol; do not fail whole request on per-symbol errors.
  const summary: Record<string, unknown> = {};
  let totalRowsUpserted = 0;
  const symbolsToRun = onlySymbols
    ? SYMBOLS.filter((s) => onlySymbols.includes(s.key))
    : SYMBOLS;

  for (const sym of symbolsToRun) {
    try {
      const { bars } = await fetchYahooDaily(sym.yahoo, backfillDays);
      if (bars.length === 0) {
        summary[sym.key] = { bars: 0, note: "Yahoo returned no bars (weekend / non-trading window?)" };
        continue;
      }
      const rows = bars.map((b) => ({
        trade_date: b.trade_date,
        symbol: sym.key,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        source: "yahoo",
      }));
      const { error: upErr } = await svc
        .from("market_ohlc")
        .upsert(rows, { onConflict: "trade_date,symbol" });
      if (upErr) throw new Error("Upsert failed: " + upErr.message);

      totalRowsUpserted += rows.length;
      const latest = rows[rows.length - 1];
      summary[sym.key] = {
        bars: rows.length,
        latest_date: latest.trade_date,
        latest_close: latest.close,
      };
    } catch (e) {
      summary[sym.key] = { error: String((e as Error)?.message ?? e) };
    }
  }

  // Audit row (best-effort)
  try {
    await svc.from("astrology_provider_runs").insert({
      provider: "yahoo",
      endpoint: "market-ohlc-refresh",
      input_hash: `backfill=${backfillDays}`,
      http_status: 200,
      success: true,
      cost_units: 0,
    });
  } catch { /* ignore */ }

  return json({
    ok: true,
    backfillDays,
    totalRowsUpserted,
    symbolsRun: symbolsToRun.length,
    summary,
  });
});
