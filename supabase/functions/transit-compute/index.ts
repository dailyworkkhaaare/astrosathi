// transit-compute
// ---------------------------------------------------------------------------
// Fills the shared "sky" tables using the FREE, validated vedic-ephemeris engine.
// This step writes ONLY the parts the free engine is accurate for:
//   - transit_moon_hourly : 24 hourly Moon rows for the current UTC day
//   - transit_planets      : the Sun row (+ its next sign-ingress)
// It does NOT touch Prokerala and costs ZERO credits.
// The slow planets (Mercury..Ketu) are filled by the NEXT step (ingress-aware).
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getSkySnapshot } from "https://esm.sh/gh/heirmez/vedic-ephemeris@main/index.mjs";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
	});
}

function err(message, status = 400, extra = {}) {
	return json({ ok: false, error: message, ...extra }, status);
}

// --- sidereal math helpers (everything derived from siderealLon only) -------
const SIGN = 30;
const NAK = 360 / 27; // 13.3333.. degrees per nakshatra
const PADA = NAK / 4; // 3.3333.. degrees per pada

function norm360(x) {
	let v = x % 360;
	if (v < 0) v += 360;
	return v;
}

// Robustly read the sidereal longitude from a planet object.
function lonOf(p) {
	if (p && typeof p.siderealLon === "number") return norm360(p.siderealLon);
	if (
		p &&
		p.rashi &&
		typeof p.rashi.index === "number" &&
		typeof p.rashiDeg === "number"
	) {
		return norm360(p.rashi.index * SIGN + p.rashiDeg);
	}
	throw new Error("Cannot read sidereal longitude from planet object");
}

function signOf(lon) {
	return Math.floor(norm360(lon) / SIGN); // 0..11
}
function degInSignOf(lon) {
	return Number((norm360(lon) % SIGN).toFixed(4));
}
function nakOf(lon) {
	return Math.floor(norm360(lon) / NAK); // 0..26
}
function padaOf(lon) {
	return Math.floor((norm360(lon) % NAK) / PADA) + 1; // 1..4
}

function moonLon(date) {
	return lonOf(getSkySnapshot(date).planets.Moon);
}
function sunLon(date) {
	return lonOf(getSkySnapshot(date).planets.Sun);
}

// Scan forward to find when a body next crosses into a new sign.
// lonFn(date) -> sidereal longitude. Returns { ts, sign } or nulls if not found.
function nextIngress(lonFn, from, maxDays, stepHours) {
	const startSign = signOf(lonFn(from));
	const stepMs = stepHours * 3600 * 1000;
	const maxMs = maxDays * 24 * 3600 * 1000;
	for (let t = stepMs; t <= maxMs; t += stepMs) {
		const d = new Date(from.getTime() + t);
		const s = signOf(lonFn(d));
		if (s !== startSign) {
			return { ts: d.toISOString(), sign: s };
		}
	}
	return { ts: null, sign: null };
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: CORS_HEADERS });
	if (req.method !== "POST") return err("Use POST", 405);

	const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
	const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!SUPABASE_URL || !SERVICE_ROLE) return err("Missing Supabase env", 500);

	// Background job: no user login required (a scheduler will call this).
	// Optional protection: if TRANSIT_CRON_SECRET is set, callers must send a
	// matching x-cron-secret header. If it is not set, the call is allowed.
	const cronSecret = Deno.env.get("TRANSIT_CRON_SECRET");
	if (cronSecret) {
		const provided = req.headers.get("x-cron-secret") || "";
		if (provided !== cronSecret)
			return err("Bad or missing x-cron-secret", 401);
	}

	const svc = createClient(SUPABASE_URL, SERVICE_ROLE);

	const now = new Date();
	const nowIso = now.toISOString();

	// ---- 1) Hourly Moon for the current UTC day (24 rows, overwritten) ----
	const dayStart = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			0,
			0,
			0,
		),
	);
	const forDate = dayStart.toISOString().slice(0, 10);

	const moonRows = [];
	for (let h = 0; h < 24; h++) {
		const slotTs = new Date(dayStart.getTime() + h * 3600 * 1000);
		const lon = moonLon(slotTs);
		moonRows.push({
			slot_hour: h,
			for_date: forDate,
			slot_ts: slotTs.toISOString(),
			moon_sign: signOf(lon),
			moon_deg: degInSignOf(lon),
			moon_nakshatra: nakOf(lon),
			moon_pada: padaOf(lon),
			updated_at: nowIso,
		});
	}

	const { error: moonErr } = await svc
		.from("transit_moon_hourly")
		.upsert(moonRows, { onConflict: "slot_hour" });
	if (moonErr) return err("Failed to write moon rows: " + moonErr.message, 500);

	// ---- 2) Sun (free + accurate) with its next sign-ingress ----
	const sLon = sunLon(now);
	const sunIngress = nextIngress(sunLon, now, 60, 6); // Sun changes sign ~monthly
	const sunRow = {
		planet: 0,
		planet_name: "Sun",
		sign: signOf(sLon),
		deg: degInSignOf(sLon),
		nakshatra: nakOf(sLon),
		pada: padaOf(sLon),
		retrograde: false,
		next_ingress_ts: sunIngress.ts,
		next_sign: sunIngress.sign,
		source: "local",
		updated_at: nowIso,
	};

	const { error: sunErr } = await svc
		.from("transit_planets")
		.upsert([sunRow], { onConflict: "planet" });
	if (sunErr) return err("Failed to write sun row: " + sunErr.message, 500);

	return json({
		ok: true,
		computedAt: nowIso,
		for_date: forDate,
		wrote: { moon_hourly_rows: moonRows.length, sun: sunRow },
		sampleMoon: {
			hour0: moonRows[0],
			hour12: moonRows[12],
			hour23: moonRows[23],
		},
	});
});
