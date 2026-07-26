// transit-planets-refresh
// ---------------------------------------------------------------------------
// Ingress-aware refresh of the 7 SLOW bodies (Mercury, Venus, Mars, Jupiter,
// Saturn, Rahu, Ketu) in transit_planets, using Prokerala planet-position.
//
// This is the ONLY transit function that spends credits. It self-decides
// whether a Prokerala call is actually needed, so a dumb daily scheduler can
// call it and it stays free most of the time:
//   - seeds the rows if any slow body is missing
//   - re-verifies when a body is NEAR a sign boundary (an ingress is due)
//   - a safety refresh if data is older than MAX_STALE_DAYS
//   - otherwise does NOTHING and returns 0 credits
//
// One Prokerala planet-position call returns ALL bodies, so refreshing any
// number of slow planets costs exactly ONE call.
//
// Guards: optional TRANSIT_CRON_SECRET (x-cron-secret header) + the existing
// PROKERALA_MONTHLY_CREDIT_CAP budget cap (prokerala_month_spend RPC).
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

// --- sidereal math (everything derived from the absolute sidereal longitude) --
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

// Slow bodies. `motion` is the rough mean daily motion (deg/day, magnitude);
// it is used ONLY to estimate the next-ingress date, which just needs to be
// good enough to know "we are getting close" — the near-boundary re-verify
// pins the exact crossing.
const SLOW = [
	{ id: 2, name: "Mercury", motion: 1.2 },
	{ id: 3, name: "Venus", motion: 1.2 },
	{ id: 4, name: "Mars", motion: 0.52 },
	{ id: 5, name: "Jupiter", motion: 0.083 },
	{ id: 6, name: "Saturn", motion: 0.034 },
	{ id: 101, name: "Rahu", motion: 0.0529, alwaysRetro: true },
	{ id: 102, name: "Ketu", motion: 0.0529, alwaysRetro: true },
];
const SLOW_IDS = SLOW.map((s) => s.id);

function numEnv(name, dflt) {
	const v = Number(Deno.env.get(name));
	return Number.isFinite(v) && v > 0 ? v : dflt;
}

// Prokerala wants datetime as YYYY-MM-DDTHH:MM:SS+00:00 (no milliseconds, no Z).
function utcOffsetString(d) {
	const p = (n, w = 2) => String(n).padStart(w, "0");
	return (
		`${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
		`T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
	);
}

function estimateIngress(lon, retro, motion, from) {
	const s = signOf(lon);
	const deg = degInSignOf(lon);
	let daysToGo;
	let nextSign;
	if (retro) {
		daysToGo = deg / motion; // moving back toward 0deg of the current sign
		nextSign = (s + 11) % 12;
	} else {
		daysToGo = (SIGN - deg) / motion; // moving forward toward 30deg
		nextSign = (s + 1) % 12;
	}
	return {
		ts: new Date(from.getTime() + daysToGo * 86400000).toISOString(),
		nextSign,
	};
}

async function fetchWithTimeout(url, init, timeoutMs) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(t);
	}
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: CORS_HEADERS });
	if (req.method !== "POST") return err("Use POST", 405);

	const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
	const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!SUPABASE_URL || !SERVICE_ROLE) return err("Missing Supabase env", 500);

	// Optional shared-secret guard (protects credits from random callers).
	const cronSecret = Deno.env.get("TRANSIT_CRON_SECRET");
	if (cronSecret) {
		const provided = req.headers.get("x-cron-secret") || "";
		if (provided !== cronSecret)
			return err("Bad or missing x-cron-secret", 401);
	}

	let body = {};
	try {
		const raw = await req.text();
		body = raw ? JSON.parse(raw) : {};
	} catch {
		body = {};
	}
	const force = body && body.force === true;

	const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
	const now = new Date();
	const nowIso = now.toISOString();

	// --- Read current slow rows and decide whether a paid call is needed ------
	const { data: existing, error: readErr } = await svc
		.from("transit_planets")
		.select("planet, planet_name, sign, deg, next_ingress_ts, updated_at")
		.in("planet", SLOW_IDS);
	if (readErr)
		return err("Failed to read transit_planets: " + readErr.message, 500);

	const present = existing || [];
	const byId = new Map(present.map((r) => [r.planet, r]));

	const WATCH_DAYS = numEnv("TRANSIT_INGRESS_WATCH_DAYS", 10);
	const WATCH_DEG = numEnv("TRANSIT_INGRESS_WATCH_DEG", 2);
	const MAX_STALE_DAYS = numEnv("TRANSIT_MAX_STALE_DAYS", 30);

	const reasons = [];
	if (force) reasons.push("force");
	const missing = SLOW_IDS.filter((id) => !byId.has(id));
	if (missing.length) reasons.push("missing:" + missing.join(","));

	for (const r of present) {
		const deg = Number(r.deg);
		if (Number.isFinite(deg) && (deg <= WATCH_DEG || deg >= SIGN - WATCH_DEG)) {
			reasons.push(`near_boundary:${r.planet}`);
		}
		if (r.next_ingress_ts) {
			const dueMs = Date.parse(r.next_ingress_ts) - now.getTime();
			if (Number.isFinite(dueMs) && dueMs <= WATCH_DAYS * 86400000) {
				reasons.push(`ingress_due:${r.planet}`);
			}
		}
		if (r.updated_at) {
			const ageMs = now.getTime() - Date.parse(r.updated_at);
			if (Number.isFinite(ageMs) && ageMs >= MAX_STALE_DAYS * 86400000) {
				reasons.push(`stale:${r.planet}`);
			}
		}
	}

	const callNeeded = reasons.length > 0;
	if (!callNeeded) {
		return json({
			ok: true,
			refreshed: false,
			reason: "idle",
			cost_units: 0,
			planets: present,
			checkedAt: nowIso,
		});
	}

	// --- Budget guard: never let transit spending run away --------------------
	const MONTHLY_CAP = Number(
		Deno.env.get("PROKERALA_MONTHLY_CREDIT_CAP") ?? "0",
	);
	if (Number.isFinite(MONTHLY_CAP) && MONTHLY_CAP > 0) {
		const { data: spent, error: spendErr } = await svc.rpc(
			"prokerala_month_spend",
		);
		if (spendErr) {
			console.error("[transit] budget check failed:", spendErr.message);
		} else if (typeof spent === "number" && spent >= MONTHLY_CAP) {
			return err("Monthly astrology API budget reached.", 503, {
				code: "budget_exceeded",
				spent,
				cap: MONTHLY_CAP,
			});
		}
	}

	const CLIENT_ID = Deno.env.get("PROKERALA_CLIENT_ID");
	const CLIENT_SECRET = Deno.env.get("PROKERALA_CLIENT_SECRET");
	if (!CLIENT_ID || !CLIENT_SECRET)
		return err("Prokerala credentials missing", 500);

	// Audit helper (feeds prokerala_month_spend). user_id is nullable for these
	// system-initiated calls; set TRANSIT_ACTOR_USER_ID to attribute them.
	const actorUserId = Deno.env.get("TRANSIT_ACTOR_USER_ID") || null;
	const audit = async (p) => {
		try {
			const { error: auditErr } = await svc
				.from("astrology_provider_runs")
				.insert({
					user_id: actorUserId,
					provider: "prokerala",
					endpoint: "/v2/astrology/planet-position",
					input_hash: "transit-slow",
					http_status: p.http_status,
					success: p.success,
					cost_units: p.cost_units ?? 0,
					error: p.error ?? null,
				});
			if (auditErr)
				console.error("[transit] audit insert failed:", auditErr.message);
		} catch (e) {
			console.error("[transit] audit insert threw:", e);
		}
	};

	// --- Token ----------------------------------------------------------------
	let accessToken;
	try {
		const tokRes = await fetchWithTimeout(
			"https://api.prokerala.com/token",
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "client_credentials",
					client_id: CLIENT_ID,
					client_secret: CLIENT_SECRET,
				}).toString(),
			},
			15000,
		);
		const tokJson = await tokRes.json().catch(() => ({}));
		if (!tokRes.ok || !tokJson.access_token) {
			await audit({
				http_status: tokRes.status,
				success: false,
				error: "provider_auth_failed",
			});
			return err("Provider authentication failed", 502);
		}
		accessToken = tokJson.access_token;
	} catch {
		await audit({
			http_status: 0,
			success: false,
			error: "provider_auth_failed",
		});
		return err("Provider authentication failed", 502);
	}

	// --- Planet-position call (one call returns ALL bodies) -------------------
	// Planet SIGNS are geocentric/global, so the reference coordinates only
	// satisfy the required API param; the returned ascendant is ignored.
	const coordinates = Deno.env.get("TRANSIT_REF_COORDS") || "28.6139,77.2090";
	const params = new URLSearchParams();
	params.set("ayanamsa", "1");
	params.set("coordinates", coordinates);
	params.set("datetime", utcOffsetString(now));
	params.set("la", "en");
	const url =
		"https://api.prokerala.com/v2/astrology/planet-position?" +
		params.toString();

	let provRes;
	try {
		provRes = await fetchWithTimeout(
			url,
			{ method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
			20000,
		);
		if (provRes.status === 429) {
			await new Promise((r) => setTimeout(r, 1500));
			provRes = await fetchWithTimeout(
				url,
				{ method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
				20000,
			);
		}
	} catch {
		await audit({ http_status: 0, success: false, error: "provider_error" });
		return err("Provider request failed", 502);
	}

	const provText = await provRes.text();
	let provJson = null;
	try {
		provJson = provText ? JSON.parse(provText) : null;
	} catch {
		provJson = null;
	}

	// Cost is reported in response HEADERS, not the body.
	const costFromHeader = Number(
		provRes.headers.get("x-credit-used") ??
			provRes.headers.get("x-credits-used") ??
			provRes.headers.get("x-ratelimit-credit-used") ??
			"",
	);
	const costUnits =
		Number.isFinite(costFromHeader) && costFromHeader > 0 ? costFromHeader : 1;

	if (!provRes.ok) {
		let msg = null;
		if (provJson && typeof provJson === "object") {
			msg =
				provJson.message ??
				provJson.error?.message ??
				(Array.isArray(provJson.errors) && provJson.errors[0]?.detail) ??
				null;
		}
		if (!msg)
			msg = provText?.trim() ? provText.trim() : `HTTP ${provRes.status}`;
		await audit({
			http_status: provRes.status,
			success: false,
			error: String(msg).slice(0, 500),
		});
		return err("Provider error: " + String(msg).slice(0, 300), 502, {
			cost_units: costUnits,
		});
	}

	const list =
		provJson && provJson.data && Array.isArray(provJson.data.planet_position)
			? provJson.data.planet_position
			: null;
	if (!list) {
		await audit({
			http_status: provRes.status,
			success: false,
			error: "unexpected_shape",
		});
		return err("Unexpected provider response shape", 502, {
			cost_units: costUnits,
		});
	}

	// --- Build + upsert the 7 slow rows ---------------------------------------
	const rows = [];
	const byProviderId = new Map(list.map((p) => [p.id, p]));
	for (const b of SLOW) {
		const item = byProviderId.get(b.id);
		if (!item) continue;
		const lon = norm360(Number(item.longitude));
		if (!Number.isFinite(lon)) continue;
		const retro = b.alwaysRetro ? true : Boolean(item.is_retrograde);
		const ing = estimateIngress(lon, retro, b.motion, now);
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
			source: "prokerala",
			updated_at: nowIso,
		});
	}

	if (!rows.length) {
		await audit({
			http_status: provRes.status,
			success: false,
			error: "no_slow_bodies_parsed",
		});
		return err("Could not parse any slow bodies", 502, {
			cost_units: costUnits,
		});
	}

	const { error: upErr } = await svc
		.from("transit_planets")
		.upsert(rows, { onConflict: "planet" });
	await audit({
		http_status: provRes.status,
		success: !upErr,
		cost_units: costUnits,
		error: upErr?.message ?? null,
	});
	if (upErr)
		return err("Failed to write slow planets: " + upErr.message, 500, {
			cost_units: costUnits,
		});

	return json({
		ok: true,
		refreshed: true,
		reason: reasons.join("; "),
		cost_units: costUnits,
		computedAt: nowIso,
		planets: rows.map((r) => ({
			planet_name: r.planet_name,
			sign: r.sign,
			signName: SIGN_NAMES[r.sign],
			deg: r.deg,
			retrograde: r.retrograde,
			next_ingress_ts: r.next_ingress_ts,
			next_sign: r.next_sign,
			nextSignName: SIGN_NAMES[r.next_sign],
		})),
	});
});
