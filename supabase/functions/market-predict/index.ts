// market-predict — deterministic gold & silver planetary outlook + real-price scoring.
// Reads TODAY'S transits your app already stores (transit_planets + transit_moon_hourly),
// applies a documented Vedic rule set, records the call with a real INR reference price
// from Metals.dev, and scores YESTERDAY'S call against the realised 24h move.
// Deterministic rules; real prices only. Cultural/entertainment feature — NOT investment advice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const err = (m, s = 400, extra = {}) => json({ ok: false, error: m, ...extra }, s);

const SIGN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const UPACHAYA_FROM_ARIES = new Set([2, 5, 9, 10]); // houses 3,6,10,11 from Aries
const P = { SUN: 0, VENUS: 3, MARS: 4, JUPITER: 5, SATURN: 6, RAHU: 101 };
const FLAT_BAND = 0.1; // % move under which a day counts as "flat"

function dignity(planet, sign) {
  const map = {
    [P.SUN]:     { ex: 0,  deb: 6,  own: [4] },
    [P.MARS]:    { ex: 9,  deb: 3,  own: [0, 7] },
    [P.JUPITER]: { ex: 3,  deb: 9,  own: [8, 11] },
    [P.VENUS]:   { ex: 11, deb: 5,  own: [1, 6] },
    [P.SATURN]:  { ex: 6,  deb: 0,  own: [9, 10] },
  };
  const d = map[planet];
  if (!d) return "neutral";
  if (sign === d.ex) return "exalted";
  if (sign === d.deb) return "debilitated";
  if (d.own.includes(sign)) return "own";
  return "neutral";
}
function moonDignity(sign) {
  if (sign === 1) return "exalted";     // Taurus
  if (sign === 7) return "debilitated"; // Scorpio
  if (sign === 3) return "own";         // Cancer
  return "neutral";
}
const leanFromScore = (s) => (s >= 2 ? "up" : s <= -2 ? "down" : "flat");

async function fetchPricesINRPerGram(apiKey) {
  const u = `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=INR&unit=g`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`metals.dev HTTP ${res.status}`);
  const j = await res.json();
  if (j.status !== "success" || !j.metals) throw new Error(`metals.dev status=${j.status}`);
  const gold = Number(j.metals.gold), silver = Number(j.metals.silver);
  if (!isFinite(gold) || !isFinite(silver)) throw new Error("metals.dev missing gold/silver");
  return { gold, silver };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Use POST", 405);

  const URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!URL || !KEY) return err("Missing Supabase env", 500);

  const secret = Deno.env.get("MARKET_CRON_SECRET");
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) return err("Bad x-cron-secret", 401);

  const METALS_KEY = Deno.env.get("METALS_DEV_API_KEY");
  const svc = createClient(URL, KEY);

  // ---- 1) Today's transits (already stored by your transit functions) ----
  const { data: planetRows, error: pErr } = await svc
    .from("transit_planets").select("planet, sign")
    .in("planet", [P.SUN, P.VENUS, P.MARS, P.JUPITER, P.SATURN, P.RAHU]);
  if (pErr) return err("Read transit_planets failed: " + pErr.message, 500);
  const bySign = {};
  for (const r of planetRows ?? []) bySign[r.planet] = r.sign;

  const { data: moonRows, error: mErr } = await svc
    .from("transit_moon_hourly").select("slot_ts, moon_sign").order("slot_ts", { ascending: true });
  if (mErr) return err("Read transit_moon_hourly failed: " + mErr.message, 500);
  let moonSign = null;
  if (moonRows?.length) {
    const now = Date.now();
    let chosen = null;
    for (const r of moonRows) if (new Date(r.slot_ts).getTime() <= now) chosen = r;
    moonSign = (chosen ?? moonRows[0]).moon_sign;
  }

  const sun = bySign[P.SUN], venus = bySign[P.VENUS], mars = bySign[P.MARS],
        jup = bySign[P.JUPITER], sat = bySign[P.SATURN], rahu = bySign[P.RAHU];
  if ([sun, venus, mars, jup, sat, moonSign].some((v) => v == null))
    return err("Transit data incomplete — run transit-compute / transit-planets-refresh first", 409,
      { have: { sun, venus, mars, jup, sat, moonSign } });

  // ---- 2) Rule engine (documented, deterministic) ----
  const push = (arr, pts, text) => { arr.push({ points: pts, text }); return pts; };
  const waxing = (((moonSign - sun) + 12) % 12) <= 5;

  const gR = []; let gS = 0;
  { const d = dignity(P.SUN, sun);
    if (d === "exalted") gS += push(gR, 2, `Sun exalted in ${SIGN[sun]} (strong for gold)`);
    else if (d === "own") gS += push(gR, 1, `Sun in own sign ${SIGN[sun]}`);
    else if (d === "debilitated") gS += push(gR, -2, `Sun debilitated in ${SIGN[sun]} (weak for gold)`); }
  { const d = dignity(P.JUPITER, jup);
    if (d === "exalted" || d === "own") gS += push(gR, 2, `Jupiter strong in ${SIGN[jup]} (expansion)`);
    else if (d === "debilitated") gS += push(gR, -1, `Jupiter debilitated in ${SIGN[jup]}`); }
  { const d = dignity(P.VENUS, venus);
    if (d === "exalted" || d === "own") gS += push(gR, 1, `Venus strong in ${SIGN[venus]}`);
    else if (d === "debilitated") gS += push(gR, -1, `Venus debilitated in ${SIGN[venus]}`); }
  if (UPACHAYA_FROM_ARIES.has(sat)) gS += push(gR, -1, `Saturn in Upachaya (${SIGN[sat]}) from Aries — pressure`);
  if (dignity(P.SATURN, sat) === "debilitated") gS += push(gR, 1, `Saturn debilitated in ${SIGN[sat]} (less pressure)`);
  if (UPACHAYA_FROM_ARIES.has(mars)) gS += push(gR, -1, `Mars in Upachaya (${SIGN[mars]}) from Aries — pressure`);
  if (dignity(P.MARS, mars) === "debilitated") gS += push(gR, 1, `Mars debilitated in ${SIGN[mars]} (less pressure)`);
  if (rahu != null) gS += push(gR, 0.5, `Rahu in ${SIGN[rahu]} (fear/inflation premium)`);

  const sR = []; let sS = 0;
  if (waxing) sS += push(sR, 2, "Waxing Moon (Shukla paksha) — bullish for silver");
  else sS += push(sR, -2, "Waning Moon (Krishna paksha) — bearish for silver");
  { const d = moonDignity(moonSign);
    if (d === "exalted" || d === "own") sS += push(sR, 1, `Moon strong in ${SIGN[moonSign]}`);
    else if (d === "debilitated") sS += push(sR, -1, `Moon debilitated in ${SIGN[moonSign]}`); }
  { const d = dignity(P.VENUS, venus);
    if (d === "exalted" || d === "own") sS += push(sR, 1, `Venus strong in ${SIGN[venus]}`);
    else if (d === "debilitated") sS += push(sR, -1, `Venus debilitated in ${SIGN[venus]}`); }
  if (sat === moonSign) sS += push(sR, -1, `Saturn with Moon in ${SIGN[moonSign]} — pressure`);
  if (mars === moonSign) sS += push(sR, -1, `Mars with Moon in ${SIGN[moonSign]} — volatility`);
  if (rahu != null) sS += push(sR, 0.5, `Rahu in ${SIGN[rahu]} (fear/inflation premium)`);

  // ---- 3) Dates (IST calendar) ----
  const istNow = Date.now() + 5.5 * 3600 * 1000;
  const tradeDate = new Date(istNow).toISOString().slice(0, 10);
  const prevDate = new Date(istNow - 24 * 3600 * 1000).toISOString().slice(0, 10);

  // ---- 4) Real price ----
  let prices = null, priceErr = null;
  if (METALS_KEY) { try { prices = await fetchPricesINRPerGram(METALS_KEY); } catch (e) { priceErr = String(e?.message ?? e); } }
  else priceErr = "METALS_DEV_API_KEY not set";

  // ---- 5) Score yesterday's calls with today's real price ----
  let scored = 0;
  if (prices) {
    const { data: pend } = await svc
      .from("market_predictions").select("id, metal, lean, ref_price")
      .eq("trade_date", prevDate).is("correct", null);
    for (const row of pend ?? []) {
      const ref = row.ref_price, nowP = prices[row.metal];
      if (ref == null || nowP == null) continue;
      const pct = ((nowP - ref) / ref) * 100;
      const dir = Math.abs(pct) < FLAT_BAND ? "flat" : pct > 0 ? "up" : "down";
      await svc.from("market_predictions").update({
        actual_price: nowP, actual_direction: dir, correct: dir === row.lean, scored_at: new Date().toISOString(),
      }).eq("id", row.id);
      scored++;
    }
  }

  // ---- 6) Write today's predictions with the real reference price ----
  const rows = [
    { trade_date: tradeDate, metal: "gold",   lean: leanFromScore(gS), score: gS, reasoning: gR, ref_price: prices?.gold ?? null },
    { trade_date: tradeDate, metal: "silver", lean: leanFromScore(sS), score: sS, reasoning: sR, ref_price: prices?.silver ?? null },
  ];
  const { error: upErr } = await svc.from("market_predictions").upsert(rows, { onConflict: "trade_date,metal" });
  if (upErr) return err("Write market_predictions failed: " + upErr.message, 500);

  return json({ ok: true, tradeDate, prevDate, scored, priceErr, prices, predictions: rows });
});