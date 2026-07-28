// transit-compute  (Swiss / astronomy-engine edition)
// ---------------------------------------------------------------------------
// Fills the shared "sky" tables using the LOCAL, validated astronomy-engine
// (Lahiri sidereal) — the SAME engine chart-gateway uses for natal charts.
// Replaces the old FREE-but-buggy vedic-ephemeris (which had the +180° issue).
//
// This step writes:
//   - transit_moon_hourly : 24 hourly Moon rows for the current UTC day
//   - transit_planets      : the Sun row (+ its next sign-ingress)
// The slow planets (Mercury..Ketu) are written by transit-planets-refresh.
//
// Cost: ZERO (pure local compute, no external API).
// Table columns, onConflict keys, and the response shape are unchanged so the
// scheduler and downstream readers (daily-horoscope, market-predict) keep
// working exactly as before.
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-cron-secret",
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

// --- sidereal presentation helpers (sign / degree / nakshatra / pada) -------
const SIGN = 30;
const NAK = 360 / 27; // 13.3333.. degrees per nakshatra
const PADA = NAK / 4; // 3.3333.. degrees per pada

function norm360(x) {
	let v = x % 360;
	if (v < 0) v += 360;
	return v;
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

// ===========================================================================
// Swiss sidereal engine (astronomy-engine) — validated Lahiri, ported verbatim
// from chart-gateway / positions.mjs. sidereal = ecliptic-of-date − ayanamsa(T).
// Only the Sun and Moon are needed here.
// ===========================================================================
const AYANAMSA_J2000 = 23.85292; // Lahiri ayanamsa at J2000.0 (deg)
const eNorm360 = (x) => ((x % 360) + 360) % 360;
function eJulianCenturiesTT(A, date) {
	return A.MakeTime(date).tt / 36525;
}
function ePrecessionSinceJ2000(T) {
	return 1.3969713 * T + 0.0003086 * T * T;
}
function eAyanamsaDeg(T) {
	return AYANAMSA_J2000 + ePrecessionSinceJ2000(T);
}
function eEclipticLonOfDate(A, body, date, aberration) {
	const vec = A.GeoVector(body, date, aberration);
	const ecl = A.Ecliptic(vec);
	return eNorm360(ecl.elon);
}
function eSiderealLonOfBody(A, body, date, aberration, T) {
	return eNorm360(eEclipticLonOfDate(A, body, date, aberration) - eAyanamsaDeg(T));
}

// Sun: apparent place (aberration=true). Moon: geocentric (aberration=false).
// Both are never retrograde. Matches positions.mjs GRAHAS definitions.
function sunLon(A, date) {
	const T = eJulianCenturiesTT(A, date);
	return eSiderealLonOfBody(A, A.Body.Sun, date, true, T);
}
function moonLon(A, date) {
	const T = eJulianCenturiesTT(A, date);
	return eSiderealLonOfBody(A, A.Body.Moon, date, false, T);
}

// Exact next sign-ingress: coarse scan to bracket the crossing, then bisect to
// ~1 minute. Direction-agnostic. lonFn(date) -> sidereal longitude (deg).
function nextIngress(lonFn, from, maxDays, stepHours) {
	const stepMs = stepHours * 3600 * 1000;
	const maxMs = maxDays * 24 * 3600 * 1000;
	const startSign = signOf(lonFn(from));
	let prevT = from.getTime();
	let prevSign = startSign;
	for (let dt = stepMs; dt <= maxMs; dt += stepMs) {
		const t = from.getTime() + dt;
		const s = signOf(lonFn(new Date(t)));
		if (s !== prevSign) {
			let lo = prevT;
			let hi = t;
			for (let i = 0; i < 48 && hi - lo > 60000; i++) {
				const mid = (lo + hi) / 2;
				if (signOf(lonFn(new Date(mid))) === prevSign) lo = mid;
				else hi = mid;
			}
			return {
				ts: new Date(hi).toISOString(),
				sign: signOf(lonFn(new Date(hi))),
			};
		}
		prevT = t;
		prevSign = s;
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

	// Optional shared-secret guard (same behavior as before).
	const cronSecret = Deno.env.get("TRANSIT_CRON_SECRET");
	if (cronSecret) {
		const provided = req.headers.get("x-cron-secret") || "";
		if (provided !== cronSecret)
			return err("Bad or missing x-cron-secret", 401);
	}

	const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
	const now = new Date();
	const nowIso = now.toISOString();

	// --- Load the local engine (dynamic import isolates any load failure) -----
	let A;
	try {
		A = await import("https://esm.sh/astronomy-engine@2.1.19");
	} catch (e) {
		return err("Astronomy engine load failed: " + String(e), 502);
	}

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
		const lon = norm360(moonLon(A, slotTs));
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

	// ---- 2) Sun (accurate + free) with its next sign-ingress ----
	const sunLonFn = (d) => sunLon(A, d);
	const sLon = norm360(sunLonFn(now));
	const sunIngress = nextIngress(sunLonFn, now, 60, 6); // Sun changes sign ~monthly
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
		source: "astronomy-engine",
		updated_at: nowIso,
	};

	const { error: sunErr } = await svc
		.from("transit_planets")
		.upsert([sunRow], { onConflict: "planet" });
	if (sunErr) return err("Failed to write sun row: " + sunErr.message, 500);

	return json({
		ok: true,
		engine: "astronomy-engine",
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
