// sade-sati-timeline  (astronomy-engine, Lahiri sidereal)
// ---------------------------------------------------------------------------
// Returns the user's full Sade Sati episode: overall start/end + the three
// phase (rising / peak / setting) date-ranges. Computed 100% locally using
// astronomy-engine, the same validated engine chart-gateway and
// transit-planets-refresh already use. No Prokerala, no DB writes, no cost.
//
// This function is READ-ONLY (only reads birth_profiles). Helpers from
// chart-gateway (isoWithOffset, tzOffsetMinutes, natal engine math) and
// transit-planets-refresh (Saturn sign-scan + bisection) are copied verbatim
// so the function stays self-contained — the established pattern here.
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
	});
}
function err(message: string, status = 400, extra: Record<string, unknown> = {}) {
	return json({ ok: false, error: message, ...extra }, status);
}

// --- tz + local wall-clock helpers (verbatim from chart-gateway) -----------
function isoWithOffset(dateStr: string, timeStr: string, timeZone: string): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	const [hh, mm, ss] = timeStr.split(":").map((v) => Number(v || 0));
	const asUTC = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);
	const offsetMin = tzOffsetMinutes(new Date(asUTC), timeZone);
	const sign = offsetMin >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMin);
	const oh = String(Math.floor(abs / 60)).padStart(2, "0");
	const om = String(abs % 60).padStart(2, "0");
	const pad = (n: number, w = 2) => String(n).padStart(w, "0");
	const local = `${y}-${pad(m)}-${pad(d)}T${pad(hh ?? 0)}:${pad(mm ?? 0)}:${pad(ss ?? 0)}`;
	return `${local}${sign}${oh}:${om}`;
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
		if (p.type !== "literal") acc[p.type] = p.value;
		return acc;
	}, {});
	const asUTC = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour === "24" ? "00" : parts.hour),
		Number(parts.minute),
		Number(parts.second),
	);
	return Math.round((asUTC - date.getTime()) / 60_000);
}

// --- Swiss sidereal engine (verbatim from chart-gateway/transit-planets) ---
const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const AYANAMSA_J2000 = 23.85292;

const norm360 = (x: number) => ((x % 360) + 360) % 360;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eJulianCenturiesTT(A: any, date: Date): number {
	return A.MakeTime(date).tt / 36525;
}
function ePrecessionSinceJ2000(T: number): number {
	return 1.3969713 * T + 0.0003086 * T * T;
}
function eAyanamsaDeg(T: number): number {
	return AYANAMSA_J2000 + ePrecessionSinceJ2000(T);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eEclipticLonOfDate(A: any, body: any, date: Date, aberration: boolean): number {
	const vec = A.GeoVector(body, date, aberration);
	const ecl = A.Ecliptic(vec);
	return norm360(ecl.elon);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealLonOfBody(A: any, body: any, date: Date, aberration: boolean, T: number): number {
	return norm360(eEclipticLonOfDate(A, body, date, aberration) - eAyanamsaDeg(T));
}

const signOf = (lon: number) => Math.floor(norm360(lon) / 30);

// --- Saturn sign-segment scan --------------------------------------------
// Coarse 3-day scan; on each sign change, bisect to ~1 min. Direction-agnostic
// so retrograde crossings are handled correctly. Produces contiguous segments
// across the whole window [from, to].
type Segment = { startTs: number; endTs: number; sign: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saturnSignAt(A: any, date: Date): number {
	const T = eJulianCenturiesTT(A, date);
	return signOf(eSiderealLonOfBody(A, A.Body.Saturn, date, true, T));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bisectCrossing(A: any, loTs: number, hiTs: number, loSign: number): number {
	let lo = loTs;
	let hi = hiTs;
	for (let i = 0; i < 60 && hi - lo > 60_000; i++) {
		const mid = (lo + hi) / 2;
		if (saturnSignAt(A, new Date(mid)) === loSign) lo = mid;
		else hi = mid;
	}
	return hi;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSaturnSegments(A: any, fromTs: number, toTs: number): Segment[] {
	const STEP_MS = 3 * 86400_000; // 3 days
	const segs: Segment[] = [];
	let segStart = fromTs;
	let curSign = saturnSignAt(A, new Date(fromTs));
	let prevTs = fromTs;
	for (let t = fromTs + STEP_MS; t <= toTs; t += STEP_MS) {
		const s = saturnSignAt(A, new Date(t));
		if (s !== curSign) {
			const crossTs = bisectCrossing(A, prevTs, t, curSign);
			segs.push({ startTs: segStart, endTs: crossTs, sign: curSign });
			segStart = crossTs;
			curSign = s;
		}
		prevTs = t;
	}
	segs.push({ startTs: segStart, endTs: toTs, sign: curSign });
	return segs;
}

// Extract the Sade Sati episode from the segment list. A retrograde dip out
// of the phase-set shorter than 60 days between two in-set runs is treated
// as part of the same episode (Saturn's ~4.5 month retro window can briefly
// pull it back over the cusp).
type Phase = "rising" | "peak" | "setting";
function extractEpisode(
	segs: Segment[],
	nowTs: number,
	targets: Set<number>,
	twelfth: number,
	moonS: number,
	second: number,
): { startTs: number; endTs: number; segs: Segment[] } | null {
	// Saturn's deep retrograde excursions out of a cusp sign can last up to
	// ~7 months; a 60-day threshold fragmented a single real Sade Sati into
	// two truncated episodes on the card. Distinct Sade Sati episodes for the
	// same Moon sign are ~29.5 years apart, so a 240-day merge can NEVER
	// merge two different episodes — it only stitches one episode across its
	// own retro dips. Validated by scripts/sade-sati-parity.ts across all 12
	// Moon signs.
	const DIP_MS = 240 * 86400_000;
	// Group consecutive in-target segments, merging across brief out-of-target dips.
	const groups: { startIdx: number; endIdx: number; startTs: number; endTs: number }[] = [];
	let i = 0;
	while (i < segs.length) {
		if (!targets.has(segs[i].sign)) { i++; continue; }
		const startIdx = i;
		let endIdx = i;
		let j = i + 1;
		while (j < segs.length) {
			if (targets.has(segs[j].sign)) {
				endIdx = j;
				j++;
				continue;
			}
			// out-of-target: peek — if the dip is short and followed by another
			// in-target segment, merge across it.
			let k = j;
			let dipMs = 0;
			while (k < segs.length && !targets.has(segs[k].sign)) {
				dipMs += segs[k].endTs - segs[k].startTs;
				k++;
			}
			if (k < segs.length && dipMs < DIP_MS) {
				endIdx = k;
				j = k + 1;
				continue;
			}
			break;
		}
		groups.push({
			startIdx,
			endIdx,
			startTs: segs[startIdx].startTs,
			endTs: segs[endIdx].endTs,
		});
		i = endIdx + 1;
	}
	if (groups.length === 0) return null;
	// Prefer the group containing `now`; otherwise the next upcoming one.
	const chosen =
		groups.find((g) => g.startTs <= nowTs && nowTs < g.endTs) ??
		groups.find((g) => g.startTs > nowTs);
	if (!chosen) return null;
	// episodeStart = first entry into twelfth (rising) within the group;
	// episodeEnd = last exit from second (setting) within the group. Fall back
	// to group bounds if the group somehow lacks one of them.
	const inGroup = segs.slice(chosen.startIdx, chosen.endIdx + 1);
	const firstRising = inGroup.find((s) => s.sign === twelfth);
	const lastSetting = [...inGroup].reverse().find((s) => s.sign === second);
	const startTs = firstRising?.startTs ?? chosen.startTs;
	const endTs = lastSetting?.endTs ?? chosen.endTs;
	// Trim segments to the [startTs, endTs] envelope for phase extraction.
	const trimmed = inGroup.filter((s) => s.endTs > startTs && s.startTs < endTs);
	void moonS;
	return { startTs, endTs, segs: trimmed };
}

function phaseFromSign(sign: number, twelfth: number, moonS: number, second: number): Phase | null {
	if (sign === twelfth) return "rising";
	if (sign === moonS) return "peak";
	if (sign === second) return "setting";
	return null;
}

// ===========================================================================
Deno.serve(async (req) => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
	if (req.method !== "POST") return err("Use POST", 405);

	const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
	const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!SUPABASE_URL || !SERVICE_ROLE) return err("Missing Supabase env", 500);

	// Auth
	const authClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
		global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const { data: authData } = await authClient.auth.getUser();
	const user = authData?.user;
	if (!user) return err("Not authenticated", 401);

	// Birth profile
	const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
	const { data: birth, error: birthErr } = await svc
		.from("birth_profiles")
		.select("birth_date, birth_time, birth_time_known, birth_timezone, latitude, longitude")
		.eq("user_id", user.id)
		.maybeSingle();
	if (birthErr) return err("Failed to load birth profile: " + birthErr.message, 500);
	if (!birth || !birth.birth_date) {
		return err("birth_profile_incomplete", 409);
	}

	const timezone = String(birth.birth_timezone ?? "Asia/Kolkata");
	const timeKnown = birth.birth_time_known !== false;
	const rawTime = timeKnown ? String(birth.birth_time ?? "12:00:00") : "12:00:00";
	const trimmed = rawTime.slice(0, 8);
	const normalizedTime = trimmed.length === 5 ? `${trimmed}:00` : trimmed.padEnd(8, "0");
	const datetimeUsed = isoWithOffset(String(birth.birth_date), normalizedTime, timezone);
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(datetimeUsed) ||
			Number.isNaN(Date.parse(datetimeUsed))) {
		return err("invalid birth datetime", 422);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let A: any;
	try {
		A = await import("https://esm.sh/astronomy-engine@2.1.19");
	} catch (e) {
		return err("Astronomy engine load failed: " + String(e), 502);
	}

	try {
		const birthDate = new Date(datetimeUsed);
		const Tb = eJulianCenturiesTT(A, birthDate);
		const moonLon = eSiderealLonOfBody(A, A.Body.Moon, birthDate, false, Tb);
		const moonSignIndex = signOf(moonLon);

		const twelfth = (moonSignIndex + 11) % 12;
		const moonS = moonSignIndex;
		const second = (moonSignIndex + 1) % 12;
		const targets = new Set([twelfth, moonS, second]);

		const now = new Date();
		// Asymmetric window: 12y back covers a currently-in-progress episode
		// even if it started a decade ago (Saturn's retro merges included); 24y
		// forward bracket guarantees the next upcoming episode is reachable
		// even when the user just finished Sade Sati (next one is ~29.5y away
		// per Moon sign, and Saturn revisits any given sign every ~29.5y — so
		// 24y forward covers the "start" of that next episode).
		const fromTs = now.getTime() - 12 * 365.25 * 86400_000;
		const toTs = now.getTime() + 24 * 365.25 * 86400_000;

		const segments = buildSaturnSegments(A, fromTs, toTs);
		const episode = extractEpisode(segments, now.getTime(), targets, twelfth, moonS, second);

		if (!episode) {
			return json({
				ok: true,
				moonSignIndex,
				moon_time_uncertain: !timeKnown,
				inSadeSati: false,
				episode: null,
				engine_version: SWISS_ENGINE_VERSION,
				computedAt: now.toISOString(),
			});
		}

		const nowTs = now.getTime();
		const inSadeSati = episode.startTs <= nowTs && nowTs < episode.endTs;
		const currentPhase = inSadeSati
			? phaseFromSign(saturnSignAt(A, now), twelfth, moonS, second)
			: null;

		// Phase ranges: within episode segments, find first-start / last-end per phase sign.
		const phaseFor = (signIndex: number, phase: Phase) => {
			const inPhase = episode.segs.filter((s) => s.sign === signIndex);
			if (inPhase.length === 0) return null;
			return {
				phase,
				signIndex,
				startTs: new Date(Math.max(inPhase[0].startTs, episode.startTs)).toISOString(),
				endTs: new Date(Math.min(inPhase[inPhase.length - 1].endTs, episode.endTs)).toISOString(),
			};
		};
		const phases = [
			phaseFor(twelfth, "rising"),
			phaseFor(moonS, "peak"),
			phaseFor(second, "setting"),
		].filter((p): p is NonNullable<typeof p> => p !== null);

		return json({
			ok: true,
			moonSignIndex,
			moon_time_uncertain: !timeKnown,
			inSadeSati,
			episode: {
				startTs: new Date(episode.startTs).toISOString(),
				endTs: new Date(episode.endTs).toISOString(),
				currentPhase,
				phases,
			},
			engine_version: SWISS_ENGINE_VERSION,
			computedAt: now.toISOString(),
		});
	} catch (e) {
		return err("compute_failed: " + String(e).slice(0, 300), 502);
	}
});
