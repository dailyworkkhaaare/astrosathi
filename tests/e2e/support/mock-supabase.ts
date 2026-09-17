import type { BrowserContext, Page, Route } from "@playwright/test";

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_PERSON_ID = "00000000-0000-4000-8000-000000000101";

export type TestLocale = "en" | "hi" | "mr";
export type TestTheme = "light" | "dark";

const TEST_USER = {
  id: TEST_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "journey@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  user_metadata: { name: "Aarohi Journey" },
  app_metadata: { provider: "email", providers: ["email"] },
  created_at: "2026-01-01T00:00:00.000Z",
};

const PROFILE = {
  user_id: TEST_USER_ID,
  onboarding_state: "ready",
  display_name: "Aarohi Journey",
  locale: "en-IN",
  tone: "calm",
  answer_length: "balanced",
  memory_enabled: false,
  timezone: "Asia/Kolkata",
};

const BIRTH_PROFILE = {
  user_id: TEST_USER_ID,
  full_name: "Aarohi Journey",
  gender: "female",
  birth_date: "1992-08-14",
  birth_time: "09:32:00",
  birth_time_known: true,
  birth_place_label: "Synthetic Pune, India",
  latitude: 18.5204,
  longitude: 73.8567,
  birth_timezone: "Asia/Kolkata",
};

const PERSON = {
  id: TEST_PERSON_ID,
  user_id: TEST_USER_ID,
  relation: "partner",
  full_name: "Vihaan Journey",
  gender: "male",
  birth_date: "1990-02-11",
  birth_time: "18:15:00",
  birth_time_known: true,
  birth_place_label: "Synthetic Jaipur, India",
  latitude: 26.9124,
  longitude: 75.7873,
  birth_timezone: "Asia/Kolkata",
  created_at: "2026-01-02T00:00:00.000Z",
};

const PERSON_CHARTS = {
  version: "person-charts-v1",
  provider: "synthetic-offline",
  provider_version: "e2e",
  related_chart_id: TEST_PERSON_ID,
  person: {
    full_name: PERSON.full_name,
    relation: PERSON.relation,
    gender: PERSON.gender,
    birth_date: PERSON.birth_date,
    birth_time: PERSON.birth_time,
    birth_time_known: PERSON.birth_time_known,
    birth_place_label: PERSON.birth_place_label,
    birth_timezone: PERSON.birth_timezone,
  },
  basic: {
    ascendant: { sign: 0, name: "Aries" },
    moon: { sign: 1, name: "Taurus", nakshatra: { index: 3, name: "Rohini", pada: 2 } },
    sun: { sign: 4, name: "Leo" },
  },
  natal: { data: { planet_position: [] } },
  charts: {},
};

const COMPATIBILITY = {
  version: "compatibility-v1",
  provider: "synthetic-offline",
  provider_version: "e2e",
  related_chart_id: TEST_PERSON_ID,
  assumed_gender: false,
  groom_is: "partner",
  self: {
    name: BIRTH_PROFILE.full_name,
    gender: BIRTH_PROFILE.gender,
    moon_sign: 1,
    moon_sign_name: "Taurus",
    moon_nakshatra_index: 3,
    moon_nakshatra: "Rohini",
    asc_sign: 0,
    asc_sign_name: "Aries",
  },
  partner: {
    related_chart_id: TEST_PERSON_ID,
    relation: PERSON.relation,
    name: PERSON.full_name,
    gender: PERSON.gender,
    moon_sign: 4,
    moon_sign_name: "Leo",
    moon_nakshatra_index: 10,
    moon_nakshatra: "Magha",
    asc_sign: 6,
    asc_sign_name: "Libra",
  },
  guna_milan: {
    total: 25,
    max: 36,
    verdict: "very_good",
    kutas: [
      { name: "Varna", got: 1, max: 1 },
      { name: "Vashya", got: 1, max: 2 },
      { name: "Tara", got: 3, max: 3 },
      { name: "Yoni", got: 3, max: 4 },
      { name: "Graha Maitri", got: 4, max: 5 },
      { name: "Gana", got: 5, max: 6 },
      { name: "Bhakoot", got: 5, max: 7 },
      { name: "Nadi", got: 3, max: 8 },
    ],
  },
  mangal: {
    self: {
      mars_house_from_lagna: 3,
      mars_house_from_moon: 2,
      manglik_from_lagna: false,
      manglik_from_moon: true,
      manglik: true,
    },
    partner: {
      mars_house_from_lagna: 6,
      mars_house_from_moon: 3,
      manglik_from_lagna: false,
      manglik_from_moon: false,
      manglik: false,
    },
    verdict: "one_manglik",
  },
  synastry: {
    partner_planets_in_self_houses: [
      { planet: "Venus", sign: 4, sign_name: "Leo", house: 5 },
      { planet: "Saturn", sign: 10, sign_name: "Aquarius", house: 11 },
    ],
    self_planets_in_partner_houses: [],
    highlights: ["partner_venus_in_self_5", "partner_saturn_in_self_11"],
  },
};

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeAccessToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url({
    aud: "authenticated",
    exp: now + 3_600,
    iat: now,
    sub: TEST_USER_ID,
    role: "authenticated",
  })}.synthetic-signature`;
}

function session() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeAccessToken(),
    refresh_token: "synthetic-refresh-token",
    expires_in: 3_600,
    expires_at: now + 3_600,
    token_type: "bearer",
    user: TEST_USER,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

function singularRequest(route: Route): boolean {
  const accept = route.request().headers()["accept"] ?? "";
  return accept.includes("application/vnd.pgrst.object+json");
}

export async function installSupabaseMock(
  page: Page,
  options: { onboardingState?: "consent_pending" | "birth_pending" | "ready" } = {},
) {
  const onboardingState = options.onboardingState ?? "ready";

  await page.route("**/*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (request.method() === "OPTIONS") return json(route, {});
    if (pathname.endsWith("/auth/v1/user")) return json(route, TEST_USER);
    if (pathname.endsWith("/auth/v1/token")) return json(route, session());

    if (pathname.endsWith("/functions/v1/person-charts")) {
      return json(route, { data: PERSON_CHARTS });
    }
    if (pathname.endsWith("/functions/v1/compatibility")) {
      return json(route, { data: COMPATIBILITY });
    }
    if (pathname.includes("/functions/v1/")) {
      return json(route, {
        error: { code: "provider_error", message: "Synthetic offline smoke response" },
      });
    }

    if (pathname.includes("/rest/v1/profiles")) {
      const profile = { ...PROFILE, onboarding_state: onboardingState };
      return json(route, singularRequest(route) ? profile : [profile]);
    }
    if (pathname.includes("/rest/v1/birth_profiles")) {
      return json(route, singularRequest(route) ? BIRTH_PROFILE : [BIRTH_PROFILE]);
    }
    if (pathname.includes("/rest/v1/related_charts")) {
      return json(route, singularRequest(route) ? PERSON : [PERSON]);
    }
    if (pathname.includes("/rest/v1/transit_planets")) return json(route, []);
    if (pathname.includes("/rest/v1/")) return json(route, singularRequest(route) ? {} : []);

    return json(route, {});
  });
}

export async function installClientPreferences(
  context: BrowserContext,
  options: { locale?: TestLocale; theme?: TestTheme } = {},
) {
  const locale = options.locale ?? "en";
  const theme = options.theme ?? "light";
  await context.addInitScript(
    ({ localeValue, themeValue }) => {
      window.localStorage.setItem("astrosaathi.lang", localeValue);
      window.localStorage.setItem("astrosaathi.theme", themeValue);
    },
    { localeValue: locale, themeValue: theme },
  );
}

export async function installAuthenticatedSession(
  context: BrowserContext,
  options: { locale?: TestLocale; theme?: TestTheme } = {},
) {
  const storedSession = JSON.stringify(session());
  await context.addInitScript(
    ({ value, localeValue, themeValue }) => {
      window.localStorage.setItem("astrosaathi-auth", value);
      window.localStorage.setItem("astrosaathi.lang", localeValue);
      window.localStorage.setItem("astrosaathi.theme", themeValue);
    },
    {
      value: storedSession,
      localeValue: options.locale ?? "en",
      themeValue: options.theme ?? "light",
    },
  );
}
