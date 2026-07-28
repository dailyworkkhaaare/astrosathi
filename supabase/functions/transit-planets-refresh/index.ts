// transit-planets-refresh  (Swiss / astronomy-engine edition)
// ---------------------------------------------------------------------------
// Refreshes the 7 SLOW bodies (Mercury, Venus, Mars, Jupiter, Saturn, Rahu,
// Ketu) in transit_planets using the LOCAL astronomy-engine (Lahiri sidereal),
// the same validated engine chart-gateway uses for natal charts.
//
// Cost: ZERO. No Prokerala token, no paid API call, no credit accounting, no
// budget cap. Compute is free and deterministic, so this simply computes all 7
// bodies at "now" and upserts them every time it is called.
//
// next_ingress_ts / next_sign are now computed EXACTLY (coarse scan + bisection
// to ~1 minute), direction-agnostic so retrograde crossings are handled
// correctly — replacing the old rough mean-motion estimate.
//
// Table columns, response shape, the optional TRANSIT_CRON_SECRET guard, and
// the astrology_provider_runs audit row are all preserved so the scheduler and
// downstream readers (daily-horoscope, market-predict) keep working unchanged.
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

// --- sidereal presentation helpers (sign / degree / nakshatra / pada) --------
const SIGN = 30;
const NAK = 360 / 27;
const PADA = NAK / 4;
const SIGN_NAMES = [
	"Aries",
	"Taurus",
	"Gemini",
	"Cancer",
	"Leo",
	"Virgo",
	"Libra",
	"Scorpio",
	"Sagittarius",
	"Capricorn",
	"Aquarius",
	"Pisces",
];

function norm360(x) {
	let v = x % 360;
	if (v < 0) v += 360;
	return v;
}
function signOf(lon) {
	return Math.floor(norm360(lon) / SIGN);
}
function degInSignOf(lon) {
	return Number((norm360(lon) % SIGN).toFixed(4));
}
function nakOf(lon) {
	return Math.floor(norm360(lon) / NAK);
}
function padaOf(lon) {
	return Math.floor((norm360(lon) % NAK) / PADA) + 1;
}

// ===========================================================================
// Swiss sidereal engine (astronomy-engine) — validated Lahiri, ported verbatim
// from chart-gateway / positions.mjs. sidereal = ecliptic-of-date − ayanamsa(T).
// ===========================================================================
const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const AYANAMSA_J2000 = 23.85292; // Lahiri ayanamsa at J2000.0 (deg)

const eNorm360 = (x) => ((x % 360) + 360) % 360;
const eNorm180 = (x) => {
	const v = eNorm360(x);
	return v > 180 ? v - 360 : v;
};
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
function eMeanNodeOfDate(T) {
	const om =
		125.0445479 -
		1934.1362891 * T +
		0.0020754 * T * T +
		(T * T * T) / 467441 -
		(T * T * T * T) / 60616000;
	return eNorm360(om);
}
function eIsRetrograde(A, body, date, aberration) {
	const l1 = eEclipticLonOfDate(A, body, date, aberration);
	const later = new Date(date.getTime() + 3600 * 1000);
	const l2 = eEclipticLonOfDate(A, body, later, aberration);
	return eNorm180(l2 - l1) < 0;
}

// Slow bodies. Planets resolve against A.Body[...]; nodes are analytic.
const SLOW = [
	{ id: 2, name: "Mercury", body: "Mercury", ab: true, canRetro: true },
	{ id: 3, name: "Venus", body: "Venus", ab: true, canRetro: true },
	{ id: 4, name: "Mars", body: "Mars", ab: true, canRetro: true },
	{ id: 5, name: "Jupiter", body: "Jupiter", ab: true, canRetro: true },
	{ id: 6, name: "Saturn", body: "Saturn", ab: true, canRetro: true },
	{ id: 101, name: "Rahu", node: "rahu", alwaysRetro: true },
	{ id: 102, name: "Ketu", node: "ketu", alwaysRetro: true },
];

// Sidereal longitude of a slow body at an arbitrary instant (deg).
function slowLonAt(A, b, date) {
	const T = eJulianCenturiesTT(A, date);
	if (b.node === "rahu") return eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T));
	if (b.node === "ketu")
		return eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T) + 180);
	return eSiderealLonOfBody(A, A.Body[b.body], date, b.ab, T);
}

// Exact next sign-ingress: coarse 12h scan to bracket the crossing, then
// bisect to ~1 minute. Direction-agnostic, so it works whether the body is
// direct or retrograde. Returns null/null if none within the horizon.
function nextIngress(A, b, from) {
	const STEP_MS = 12 * 3600 * 1000;
	const HORIZON_MS = 1000 * 86400000; // covers even Saturn (~882 days / sign)
	const startSign = signOf(slowLonAt(A, b, from));
	let prevT = from.getTime();
	let prevSign = startSign;
	for (let dt = STEP_MS; dt <= HORIZON_MS; dt += STEP_MS) {
		const t = from.getTime() + dt;
		const s = signOf(slowLonAt(A, b, new Date(t)));
		if (s !== prevSign) {
			let lo = prevT;
			let hi = t;
			for (let i = 0; i < 48 && hi - lo > 60000; i++) {
				const mid = (lo + hi) / 2;
				if (signOf(slowLonAt(A, b, new Date(mid))) === prevSign) lo = mid;
				else hi = mid;
			}
			return {
				ts: new Date(hi).toISOString(),
				nextSign: signOf(slowLonAt(A, b, new Date(hi))),
			};
		}
		prevT = t;
		prevSign = s;
	}
	return { ts: null, nextSign: null };
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: CORS_HEADERS });
	if (req.method !== "POST") return err("Use POST", 405);

	const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
	const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!SUPABASE_URL || !SERVICE_ROLE) return err("Missing Supabase env", 500);

	// Optional shared-secret guard (protects against random callers spamming
	// compute + DB writes). Preserved so the existing cron keeps working.
	const cronSecret = Deno.env.get("TRANSIT_CRON_SECRET");
	if (cronSecret) {
		const provided = req.headers.get("x-cron-secret") || "";
		if (provided !== cronSecret) return err("Bad or missing x-cron-secret", 401);
	}

	let reqBody = {};
	try {
		const raw = await req.text();
		reqBody = raw ? JSON.parse(raw) : {};
	} catch {
		reqBody = {};
	}
	const force = reqBody && reqBody.force === true;

	const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
	const now = new Date();
	const nowIso = now.toISOString();

	// Audit helper (kept for observability). provider is now the local engine and
	// cost is always 0, so prokerala_month_spend never counts these.
	const actorUserId = Deno.env.get("TRANSIT_ACTOR_USER_ID") || null;
	const audit = async (p) => {
		try {
			const { error: auditErr } = await svc
				.from("astrology_provider_runs")
				.insert({
					user_id: actorUserId,
					provider: "astronomy-engine",
					endpoint: "local/transit-slow",
					input_hash: "transit-slow",
					http_status: p.http_status,
					success: p.success,
					cost_units: 0,
					error: p.error ?? null,
				});
			if (auditErr)
				console.error("[transit] audit insert failed:", auditErr.message);
		} catch (e) {
			console.error("[transit] audit insert threw:", e);
		}
	};

	// --- Load the local engine (dynamic import isolates any load failure) -----
	let A;
	try {
		A = await import("https://esm.sh/astronomy-engine@2.1.19");
	} catch (e) {
		await audit({ http_status: 502, success: false, error: "engine_load_failed" });
		return err("Astronomy engine load failed: " + String(e), 502);
	}

	// --- Compute the 7 slow rows locally --------------------------------------
	const rows = [];
	try {
		for (const b of SLOW) {
			const lon = norm360(slowLonAt(A, b, now));
			const retro = b.alwaysRetro
				? true
				: eIsRetrograde(A, A.Body[b.body], now, b.ab);
			const ing = nextIngress(A, b, now);
			rows.push({
				planet: b.id,
				planet_name: b.name,
				sign: signOf(lon),
				deg: degInSignOf(lon),
				nakshatra: nakOf(lon),
				pada: padaOf(lon),
				retrograde: retro,
				next_ingress_ts: ing.ts,
				next_sign: ing.nextSign,
				source: "astronomy-engine",
				updated_at: nowIso,
			});
		}
	} catch (e) {
		await audit({
			http_status: 500,
			success: false,
			error: "compute_failed: " + String(e).slice(0, 400),
		});
		return err("Local compute failed: " + String(e).slice(0, 300), 502);
	}

	const { error: upErr } = await svc
		.from("transit_planets")
		.upsert(rows, { onConflict: "planet" });
	await audit({
		http_status: 200,
		success: !upErr,
		error: upErr?.message ?? null,
	});
	if (upErr)
		return err("Failed to write slow planets: " + upErr.message, 500);

	return json({
		ok: true,
		refreshed: true,
		engine: "astronomy-engine",
		engine_version: SWISS_ENGINE_VERSION,
		reason: force ? "force; swiss-local" : "swiss-local",
		cost_units: 0,
		computedAt: nowIso,
		planets: rows.map((r) => ({
			planet_name: r.planet_name,
			sign: r.sign,
			signName: SIGN_NAMES[r.sign],
			deg: r.deg,
			retrograde: r.retrograde,
			next_ingress_ts: r.next_ingress_ts,
			next_sign: r.next_sign,
			nextSignName: r.next_sign != null ? SIGN_NAMES[r.next_sign] : null,
		})),
	});
});
