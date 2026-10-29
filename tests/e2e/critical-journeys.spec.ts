import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  installSupabaseMock,
  TEST_PERSON_ID,
} from "./support/mock-supabase";
import { VARGA_KEYS } from "../../src/lib/chart-types";
import { getDailyMantraIndex, MANTRAS } from "../../src/lib/mantras";

const EXPECTED_VARGA_ENUMS: Record<(typeof VARGA_KEYS)[number], string> = {
  D1: "d1_rashi",
  D2: "d2_hora",
  D3: "d3_drekkana",
  D4: "d4_chaturthamsha",
  D7: "d7_saptamsha",
  D9: "d9_navamsha",
  D10: "d10_dashamsha",
  D12: "d12_dwadashamsha",
  D16: "d16_shodashamsha",
  D20: "d20_vimshamsha",
  D24: "d24_chaturvimshamsha",
  D27: "d27_bhamsha",
  D30: "d30_trimshamsha",
  D40: "d40_khavedamsha",
  D45: "d45_akshavedamsha",
  D60: "d60_shashtiamsha",
};

test.describe("public and auth routing", () => {
  test("landing, language and sign-in entry points render", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AstroSaathi/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/language");
    await expect(page.getByText("Choose your language", { exact: true })).toBeVisible();

    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("a protected route returns an unauthenticated visitor to sign in", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("onboarding routing", () => {
  test.beforeEach(async ({ context }) => installAuthenticatedSession(context));

  test("consent-pending accounts cannot bypass consent", async ({ page }) => {
    await installSupabaseMock(page, { onboardingState: "consent_pending" });
    await page.goto("/home");
    await expect(page).toHaveURL(/\/onboarding\/consent$/);
    await expect(page.getByRole("heading", { name: "Your privacy matters" })).toBeVisible();
  });

  test("birth-pending accounts cannot bypass birth details", async ({ page }) => {
    await installSupabaseMock(page, { onboardingState: "birth_pending" });
    await page.goto("/today");
    await expect(page).toHaveURL(/\/onboarding\/birth$/);
    await expect(page.getByRole("heading", { name: "Your birth details" })).toBeVisible();
  });

  test("birth details reveal the time and place fields after identity", async ({ page }) => {
    await installSupabaseMock(page, { onboardingState: "birth_pending" });
    await page.goto("/onboarding/birth");

    await expect(page.getByText("About you", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Date of birth")).not.toBeVisible();
    await page.getByLabel("Full name").fill("Aarav Sharma");
    await expect(page.getByLabel("Full name")).toHaveAttribute("enterkeyhint", "next");
    await page.getByRole("button", { name: "Continue to birth details" }).click();

    await expect(page.getByText("Birth details", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Date of birth")).toBeVisible();
    await expect(page.getByLabel("Place of birth")).toBeVisible();
    await expect(page.getByLabel("Date of birth")).toHaveAttribute("enterkeyhint", "next");
    await expect(page.getByLabel("Time of birth")).toHaveAttribute("enterkeyhint", "next");
    await expect(page.getByLabel("Place of birth")).toHaveAttribute("enterkeyhint", "done");
    await expect(page.getByRole("button", { name: "Calculate my chart" })).toBeVisible();
  });

  test("a no-op birth save shows the ceremony without priming charts", async ({ page }) => {
    let primeCalls = 0;
    await installSupabaseMock(page, { onboardingState: "birth_pending" });
    await page.route("**/functions/v1/prime-charts", async (route) => {
      primeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    });
    await page.goto("/onboarding/birth");

    await expect(page.getByLabel("Full name")).toHaveValue("Aarohi Journey");
    await page.getByRole("button", { name: "Continue to birth details" }).click();
    await page.getByRole("button", { name: "Calculate my chart" }).click();

    await expect(page.getByRole("heading", { name: "Casting your chart…" })).toBeVisible();
    await expect(page.getByText("Your chart is ready", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Explore my chart" }).click();
    await expect(page).toHaveURL(/\/home\/?$/);
    expect(primeCalls).toBe(0);
  });

  test("a changed birth save shows the ceremony and primes charts once", async ({ page }) => {
    let primeCalls = 0;
    await installSupabaseMock(page, { onboardingState: "birth_pending" });
    await page.route("**/functions/v1/prime-charts", async (route) => {
      primeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    });
    await page.goto("/onboarding/birth");

    await expect(page.getByLabel("Full name")).toHaveValue("Aarohi Journey");
    await page.getByRole("button", { name: "Continue to birth details" }).click();
    await page.getByLabel("Date of birth").fill("1992-08-15");
    await page.getByRole("button", { name: "Calculate my chart" }).click();

    await expect(page.getByRole("heading", { name: "Casting your chart…" })).toBeVisible();
    await expect(page.getByText("Your chart is ready", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Explore my chart" }).click();
    await expect(page).toHaveURL(/\/home\/?$/);
    await expect.poll(() => primeCalls).toBe(1);
  });

  test("editing birth details on a ready account skips the chart-ready screen", async ({
    page,
  }) => {
    await installSupabaseMock(page, { onboardingState: "ready" });
    await page.goto("/onboarding/birth");

    await expect(page.getByLabel("Full name")).toHaveValue("Aarohi Journey");
    await page.getByRole("button", { name: "Continue to birth details" }).click();
    await page.getByRole("button", { name: "Calculate my chart" }).click();

    await expect(page).toHaveURL(/\/home\/?$/);
    await expect(page.getByText("Your chart is ready", { exact: true })).toHaveCount(0);
  });
});

test.describe("authenticated critical journeys", () => {
  test.beforeEach(async ({ context, page }) => {
    await installAuthenticatedSession(context);
    await installSupabaseMock(page);
  });

  const routes = [
    { label: "chart", path: "/home", heading: "Your chart" },
    { label: "chat", path: "/chat", heading: "How can I help with your chart today?" },
    { label: "Today", path: "/today", heading: "Today" },
    { label: "people", path: "/people", heading: "People" },
    {
      label: "compatibility",
      path: `/people/${TEST_PERSON_ID}/compatibility`,
      heading: "Compatibility",
    },
    { label: "Journey", path: "/life", heading: "Life Timeline" },
    { label: "settings", path: "/settings", heading: "Settings" },
  ];

  for (const journey of routes) {
    test(`${journey.label} route renders its primary screen`, async ({ page }) => {
      await page.goto(journey.path);
      await expect(page).toHaveURL(new RegExp(`${journey.path}/?$`));
      await expect(page.getByRole("heading", { name: journey.heading, level: 1 })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");
    });
  }

  test("mobile five-world dock reaches every existing destination", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "The five-world dock is mobile-only in Action 5.1.",
    );
    await page.goto("/home");

    const dock = page.getByRole("navigation", { name: "Primary" });
    await expect(dock.getByRole("link", { name: "Settings" })).toHaveCount(0);

    const worlds = [
      { label: "Today", path: "/today" },
      { label: "My Cosmos", path: "/home" },
      { label: "Ask", path: "/chat" },
      { label: "Journey", path: "/journey" },
      { label: "Connections", path: "/people" },
    ];

    for (const world of worlds) {
      const link = dock.getByRole("link", { name: world.label });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${world.path}/?$`));
      if (world.path === "/chat") {
        // Ask opens as a full-screen sheet: no dock, its own close.
        await expect(dock).toHaveCount(0);
        await page.getByRole("button", { name: "Close" }).click();
        await expect(dock).toBeVisible();
        continue;
      }
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  test("mobile five-world dock triggers tactile feedback fallback", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile tactile feedback is mobile-only.");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (pattern: VibratePattern) => {
          (window as Window & { __asVibrations?: VibratePattern[] }).__asVibrations ??= [];
          (window as Window & { __asVibrations: VibratePattern[] }).__asVibrations.push(pattern);
          return true;
        },
      });
    });
    await page.goto("/today");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Ask" })
      .click();

    await expect(page).toHaveURL(/\/chat\/?$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __asVibrations?: VibratePattern[] }).__asVibrations?.length ?? 0,
        ),
      )
      .toBeGreaterThan(0);
  });

  test("mobile shell reserves the native bottom chrome area", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile shell geometry is mobile-only.");

    for (const viewport of [
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/today");
      await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

      const shell = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(
          (candidate) => {
            const styles = getComputedStyle(candidate);
            const rect = candidate.getBoundingClientRect();
            return styles.position === "fixed" && rect.width > 0 && rect.height > 0;
          },
        );
        const main = document.querySelector("main");
        if (!nav || !main) return null;
        const navRect = nav.getBoundingClientRect();
        const mainStyles = getComputedStyle(main);
        return {
          navPosition: getComputedStyle(nav).position,
          navBottom: Math.round(navRect.bottom),
          viewportHeight: window.innerHeight,
          mainPaddingBottom: Number.parseFloat(mainStyles.paddingBottom),
        };
      });

      expect(shell).not.toBeNull();
      expect(shell?.navPosition).toBe("fixed");
      expect(shell?.navBottom).toBeLessThanOrEqual(shell?.viewportHeight ?? 0);
      expect(shell?.mainPaddingBottom).toBeGreaterThanOrEqual(80);
    }
  });

  test("mobile Cosmos sections scroll as chips and keep the active one in view", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "The chip scroller check is mobile-only.");
    await page.goto("/home");

    const sections = page.getByRole("tablist", { name: "Your chart" });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole("tab")).toHaveCount(8);
    await expect(sections.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const remedies = sections.getByRole("tab", { name: "Remedies" });
    await remedies.click();
    await expect(page).toHaveURL(/\/home\?tab=remedies$/);
    await expect(remedies).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Lo Shu grid" }).click();
    await expect(page).toHaveURL(/\/home\?tab=loshu$/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const list = document.querySelector('[role="tablist"]')!.getBoundingClientRect();
          const tab = document.querySelector('[role="tab"][aria-selected="true"]')!;
          const box = tab.getBoundingClientRect();
          return box.left >= list.left - 1 && box.right <= list.right + 1;
        }),
      )
      .toBe(true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("desktop rail expands with keyboard and keeps five-world routing", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "The celestial rail is desktop-only in Action 5.2.",
    );
    await page.goto("/home");

    const expand = page.getByRole("button", { name: "Expand navigation" });
    await expand.focus();
    await expand.press("Enter");

    const rail = page.getByRole("navigation", { name: "Primary" });
    await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "My Cosmos" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await rail.getByRole("link", { name: "Connections" }).click();
    await expect(page).toHaveURL(/\/people\/?$/);
    await expect(rail.getByRole("link", { name: "Connections" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("profile launcher keeps Settings reachable outside primary navigation", async ({
    page,
  }, testInfo) => {
    await page.goto("/today");
    const launcher = page.getByRole("button", {
      name: /Profile and settings.*Moon sign Taurus/,
    });
    await expect(launcher).toBeVisible();
    await launcher.click();

    await expect(page.getByText("Aarohi Journey", { exact: true })).toBeVisible();
    if (testInfo.project.name === "mobile-chrome") {
      await expect(page.getByRole("link", { name: "Edit birth details" })).toBeVisible();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
    } else {
      await expect(page.getByRole("menuitem", { name: "Edit birth details" })).toBeVisible();
      await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/settings\/?$/);
  });

  test("mobile profile launcher stays with the page header while scrolling", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "The profile launcher is mobile-only.");
    await page.goto("/today");

    const launcher = page.getByRole("button", { name: "Profile and settings" });
    const initialBox = await launcher.boundingBox();
    expect(initialBox).not.toBeNull();

    await page.locator("main").evaluate((main) => {
      const longPageProbe = document.createElement("div");
      longPageProbe.setAttribute("data-test-scroll-probe", "");
      longPageProbe.style.height = "1200px";
      main.append(longPageProbe);
    });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(async () => (await launcher.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
      .toBeLessThan((initialBox?.y ?? 0) - 100);
  });

  test("mobile chat shell does not show the shared floating profile launcher", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "The chat shell is custom on mobile.");
    await page.goto("/chat");

    await expect(page.getByRole("button", { name: /Profile and settings/ })).toHaveCount(0);
  });

  test("mobile chat history opens as a bottom sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Chat history sheet is mobile-only.");
    await page.goto("/chat");

    await page.getByRole("button", { name: "Open sidebar" }).click();
    const sheet = page.getByRole("dialog", { name: "Conversations" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(600);

    const geometry = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        width: Math.round(rect.width),
      };
    });

    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 12);
    expect(geometry.left).toBe(0);
    expect(geometry.width).toBe(geometry.viewportWidth);
    expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);
    expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight * 0.9);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("settings subpages keep a consistent native back header", async ({ page }) => {
    for (const path of [
      "/settings/preferences",
      "/settings/memory",
      "/settings/proactive",
      "/settings/voice",
    ]) {
      await page.goto(path);
      const back = page.getByRole("link", { name: "Back to settings" });
      await expect(back).toBeVisible();
      await expect(back).toHaveClass(/h-11/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("world screens no longer show the Subject/Time context bar", async ({ page }) => {
    for (const path of ["/today", "/home", "/journey", "/people"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.getByRole("region", { name: "Current chart context" })).toHaveCount(0);
    }
  });

  test("Today overview leads with one personalized daily signal", async ({ page }) => {
    let dailyCalls = 0;
    await page.route("**/functions/v1/daily-horoscope", async (route) => {
      dailyCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incomplete: false,
          date: "2026-09-09",
          summary:
            "Choose a steadier pace today. Your current Venus period supports patient, practical attention.",
          focus: "Finish one meaningful task before adding another.",
          areas: [],
          lucky: null,
          reasons: {
            summary: [
              {
                kind: "dasha",
                text: "Venus is the active Mahadasha and Antardasha ruler.",
              },
            ],
            areas: {},
          },
        }),
      });
    });

    await page.goto("/today");

    const signal = page.getByRole("heading", { name: "Choose a steadier pace today." });
    await expect(signal).toBeVisible();
    await expect(
      page.getByText("Your current Venus period supports patient, practical attention."),
    ).toBeVisible();
    await expect(page.getByText("Finish one meaningful task before adding another.")).toBeVisible();
    await expect(
      page.getByText("Venus is the active Mahadasha and Antardasha ruler."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the full daily reading" })).toBeVisible();
    await expect(page.getByText("EXPERIMENTAL MARKET LENS")).toBeVisible();

    const signalPrecedesSky = await page.locator("#daily-signal-heading").evaluate((element) => {
      const sky = document.querySelector("#today-heading");
      return !!sky && !!(element.compareDocumentPosition(sky) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(signalPrecedesSky).toBe(true);
    expect(dailyCalls).toBe(1);

    await page.getByRole("button", { name: "Ask about this" }).click();
    await expect(page).toHaveURL(/\/chat\/?$/);
    await expect(page.getByRole("textbox", { name: "Message AstroSaathi" })).toHaveValue(
      "What should I focus on today, based on my chart and today's sky?",
    );
  });

  test("Today daily signal shares through the native share affordance", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Native sharing is mobile-only.");

    await page.addInitScript(() => {
      Object.defineProperty(window, "__sharedToday", { configurable: true, writable: true });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (payload: unknown) => {
          (window as Window & { __sharedToday?: unknown }).__sharedToday = payload;
        },
      });
    });
    await page.route("**/functions/v1/daily-horoscope", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incomplete: false,
          date: "2026-09-09",
          summary: "A calm pace creates room for what matters.",
          focus: null,
          areas: [],
          lucky: null,
          reasons: { summary: [], areas: {} },
        }),
      });
    });

    await page.goto("/today");
    await page.getByRole("button", { name: "Share" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as Window & { __sharedToday?: unknown }).__sharedToday),
        ),
      )
      .toBe(true);

    const shared = await page.evaluate(
      () =>
        (window as Window & { __sharedToday?: { title?: string; text?: string } }).__sharedToday,
    );
    expect(shared).toMatchObject({
      title: "Today's AstroSaathi signal",
      text: "A calm pace creates room for what matters.",
    });
  });

  test("Today empty daily signal stays compact and actionable on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "First-viewport geometry is mobile-only.");

    await page.route("**/functions/v1/daily-horoscope", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incomplete: false,
          date: "2026-09-09",
          summary: "",
          focus: null,
          areas: [],
          lucky: null,
          reasons: { summary: [], areas: {} },
        }),
      });
    });

    await page.goto("/today");
    const signal = page.locator('section[aria-labelledby="daily-signal-heading"]');
    await expect(signal).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your daily signal is still taking shape" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask about this" })).toBeVisible();

    const box = await signal.boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(220);
  });

  test("Today timing empty state stays compact on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Recovery geometry is mobile-only.");

    await page.goto("/today");
    const timing = page.locator('section[aria-labelledby="today-heading"]');
    await expect(timing).toBeVisible();
    const recovery = timing.locator("div.border-dashed");
    await expect(recovery).toBeVisible();

    const box = await recovery.boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(80);
  });

  test("daily horoscope detail preserves every reading and evidence group", async ({ page }) => {
    let dailyCalls = 0;
    await page.route("**/functions/v1/daily-horoscope", async (route) => {
      dailyCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incomplete: false,
          date: "2026-09-09",
          summary: "A clear, patient rhythm can help you make room for what matters today.",
          focus: "Protect one uninterrupted hour for your most important work.",
          areas: [
            { key: "work", text: "Steady follow-through matters more than a quick finish." },
            { key: "wellbeing", text: "A quieter evening can restore your attention." },
          ],
          lucky: { color: "Saffron", number: "6", direction: "East" },
          reasons: {
            summary: [
              { kind: "dasha", text: "Venus is the active Mahadasha and Antardasha ruler." },
            ],
            areas: {
              work: [{ kind: "transit", text: "Mercury is moving through your tenth house." }],
              wellbeing: [{ kind: "natal", text: "Your Moon placement values steady routines." }],
            },
          },
        }),
      });
    });

    await page.goto("/today/horoscope");

    await expect(page.getByRole("heading", { name: "Today's horoscope", level: 1 })).toBeVisible();
    await expect(
      page.getByText("A clear, patient rhythm can help you make room for what matters today."),
    ).toBeVisible();
    await expect(
      page.getByText("Steady follow-through matters more than a quick finish."),
    ).toBeVisible();
    await expect(page.getByText("A quieter evening can restore your attention.")).toBeVisible();
    await expect(
      page.getByText("Protect one uninterrupted hour for your most important work."),
    ).toBeVisible();
    await expect(page.getByText("Saffron")).toBeVisible();
    await expect(page.getByText("6", { exact: true })).toBeVisible();
    await expect(page.getByText("East")).toBeVisible();

    const evidenceButtons = page.getByRole("button", { name: "Show the chart behind this" });
    await evidenceButtons.nth(0).click();
    await expect(
      page.getByText("Venus is the active Mahadasha and Antardasha ruler."),
    ).toBeVisible();
    await page
      .getByText("Work & focus", { exact: true })
      .locator("xpath=ancestor::li")
      .getByRole("button", { name: "Show the chart behind this" })
      .click();
    await expect(page.getByText("Mercury is moving through your tenth house.")).toBeVisible();
    expect(dailyCalls).toBe(1);
  });

  test("Panchang detail keeps the local day and every computed value", async ({ page }) => {
    const moonSlot = new Date(Date.now() - 60_000).toISOString();
    await page.route("**/rest/v1/transit_planets*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ planet: 0, sign: 2, deg: 10 }]),
      });
    });
    await page.route("**/rest/v1/transit_moon_hourly*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            slot_ts: moonSlot,
            moon_sign: 4,
            moon_deg: 10,
            moon_nakshatra: 9,
          },
        ]),
      });
    });

    await page.goto("/today/panchang");

    const localDate = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    );
    await expect(page.getByRole("heading", { name: "Panchang", level: 1 })).toBeVisible();
    await expect(page.getByText(localDate, { exact: true })).toBeVisible();
    await expect(page.getByText("Shukla Shashthi", { exact: true })).toBeVisible();
    await expect(page.getByText("Magha · Pada 3", { exact: true })).toBeVisible();
    await expect(page.getByText("Siddhi", { exact: true })).toBeVisible();
    await expect(page.getByText("Kaulava", { exact: true })).toBeVisible();
    await expect(page.getByText("Sunrise", { exact: true })).toBeVisible();
    await expect(page.getByText("Sunset", { exact: true })).toBeVisible();
    await expect(page.getByText("Rahu Kaal", { exact: true })).toBeVisible();
    await expect(page.getByText("Abhijit Muhurat", { exact: true })).toBeVisible();
  });

  test("transit highlight preserves its chart mapping and opens an editable Ask seed", async ({
    page,
  }) => {
    const moonSlot = new Date(Date.now() - 60_000).toISOString();
    const ingress = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string };
      if (body.resource !== "planets") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            planet_position: [
              { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
              { name: "Sun", rasi: { id: 5, name: "Virgo" }, degree: 12 },
            ],
          },
        }),
      });
    });
    await page.route("**/rest/v1/transit_planets*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            planet: 6,
            sign: 10,
            nakshatra: 22,
            pada: 2,
            retrograde: false,
            next_ingress_ts: ingress,
            next_sign: 11,
          },
        ]),
      });
    });
    await page.route("**/rest/v1/transit_moon_hourly*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            slot_ts: moonSlot,
            moon_sign: 3,
            moon_deg: 10,
            moon_nakshatra: 7,
            moon_pada: 1,
          },
        ]),
      });
    });

    await page.goto("/today");

    const highlight = page.getByRole("article", { name: /Saturn enters Pisces in 2 days/ });
    await expect(highlight).toBeVisible();
    await expect(highlight.getByText("Saturn → Pisces", { exact: true })).toBeVisible();
    await expect(highlight.getByText("House 12", { exact: true })).toBeVisible();
    await highlight.getByRole("button", { name: "Ask what this means" }).click();

    await expect(page).toHaveURL(/\/chat\/?$/);
    await expect(page.getByRole("textbox", { name: "Message AstroSaathi" })).toHaveValue(
      "Saturn is entering Pisces in 2 days — what shifts for me?",
    );
  });

  test("daily mantra keeps its deterministic selection and localized practice framing", async ({
    page,
  }) => {
    const mantra = MANTRAS[getDailyMantraIndex()];
    await page.goto("/today");

    const practice = page.getByRole("region", { name: "Daily Mantra" });
    await expect(practice.getByText("Optional practice", { exact: true })).toBeVisible();
    await expect(practice.locator('[lang="sa"]')).toHaveText(mantra.sanskrit);
    await expect(practice.getByText(mantra.transliteration, { exact: true })).toBeVisible();
    await expect(
      practice.getByText(
        "A traditional phrase for reflection. Use it only if it feels meaningful to you.",
        { exact: true },
      ),
    ).toBeVisible();

    await page.context().addInitScript(() => window.localStorage.setItem("astrosaathi.lang", "hi"));
    await page.reload();

    const hindiPractice = page.getByRole("region", { name: "आज का मंत्र" });
    await expect(hindiPractice.getByText("वैकल्पिक अभ्यास", { exact: true })).toBeVisible();
    await expect(hindiPractice.locator('[lang="sa"]')).toHaveText(mantra.sanskrit);
  });

  test("market views preserve the experimental boundary and computed data", async ({ page }) => {
    await page.route("**/rest/v1/market_predictions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            trade_date: "2026-09-09",
            metal: "gold",
            lean: "down",
            score: -2,
            reasoning: [{ points: -1, text: "", code: "sun.own" }],
            ref_price: null,
            correct: true,
          },
          {
            trade_date: "2026-09-09",
            metal: "silver",
            lean: "up",
            score: 2,
            reasoning: [{ points: 1, text: "", code: "moon.waxing" }],
            ref_price: null,
            correct: false,
          },
          {
            trade_date: "2026-09-08",
            metal: "gold",
            lean: "flat",
            score: 0,
            reasoning: [],
            ref_price: null,
            correct: true,
          },
          {
            trade_date: "2026-09-08",
            metal: "silver",
            lean: "flat",
            score: 0,
            reasoning: [],
            ref_price: null,
            correct: true,
          },
        ]),
      });
    });
    await page.route("**/rest/v1/financial_barometer_daily*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            barometer_date: "2026-09-09",
            asset_key: "nifty50",
            fused_probability: 0.68,
            confidence_score: 82,
            directional_bias: "bullish",
            inputs: { source_coverage: 0.75 },
          },
          {
            barometer_date: "2026-09-09",
            asset_key: "mcxgold",
            fused_probability: 0.39,
            confidence_score: 63,
            directional_bias: "bearish",
            inputs: { source_coverage: 0.5 },
          },
          {
            barometer_date: "2026-09-09",
            asset_key: "mcxsilver",
            fused_probability: 0.39,
            confidence_score: 63,
            directional_bias: "bearish",
            inputs: { source_coverage: 0.5 },
          },
        ]),
      });
    });
    await page.route("**/rest/v1/bradley_siderograph_daily*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { bradley_date: "2026-09-08", p_raw: -1.2 },
          { bradley_date: "2026-09-09", p_raw: 0.3 },
          { bradley_date: "2026-09-10", p_raw: 1.1 },
        ]),
      });
    });

    await page.goto("/today/markets");

    await expect(page.getByRole("heading", { name: "Market indicators", level: 1 })).toBeVisible();
    await expect(page.getByText("Experimental market indicator", { exact: true })).toHaveCount(4);
    const disclaimer = page.getByText(
      "A cultural, entertainment reading based on planetary positions — not investment advice. No buy or sell recommendations.",
      { exact: true },
    );
    await expect(disclaimer).toHaveCount(2);
    await expect(disclaimer.first()).toBeVisible();
    await expect(page.getByText("Leaning down", { exact: true })).toBeVisible();
    await expect(page.getByText("Leaning up", { exact: true })).toBeVisible();
    await expect(page.getByText("75% correct · 3 of 4 calls", { exact: true })).toBeVisible();
    await expect(page.getByText("Nifty 50", { exact: true })).toBeVisible();
    await expect(page.getByText("68%", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Market Timing Curve", level: 2 }),
    ).toBeVisible();
  });

  test("nudges retain their sent-only lifecycle when explored or dismissed", async ({ page }) => {
    const statusUpdates: string[] = [];
    const listFilters: string[] = [];
    let nudges = [
      {
        id: "nudge-dasha",
        kind: "dasha_change",
        topic: "Saturn mahadasha",
        title: "A new timing chapter begins",
        body: "Take a moment to notice what is becoming more important.",
        priority: "high",
        status: "sent",
        scheduled_for: "2026-09-09T06:00:00.000Z",
        sent_at: "2026-09-09T06:01:00.000Z",
        expires_at: "2026-09-11T06:00:00.000Z",
        created_at: "2026-09-08T06:00:00.000Z",
      },
      {
        id: "nudge-transit",
        kind: "transit_alert",
        topic: null,
        title: "A transit is worth a closer look",
        body: "Your chart has fresh timing context today.",
        priority: "normal",
        status: "sent",
        scheduled_for: "2026-09-09T05:00:00.000Z",
        sent_at: "2026-09-09T05:01:00.000Z",
        expires_at: null,
        created_at: "2026-09-08T05:00:00.000Z",
      },
    ];

    await page.route("**/rest/v1/user_proactive_nudges*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "GET") {
        listFilters.push(url.searchParams.get("status") ?? "");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(nudges),
        });
        return;
      }

      const update = JSON.parse(request.postData() ?? "{}") as { status?: string };
      const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
      statusUpdates.push(update.status ?? "");
      nudges = nudges.filter((nudge) => nudge.id !== id);
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/nudges");

    const dashaNudge = page.getByRole("article", { name: "A new timing chapter begins" });
    const transitNudge = page.getByRole("article", { name: "A transit is worth a closer look" });
    await expect(dashaNudge.getByText("Important", { exact: true })).toBeVisible();
    await expect(dashaNudge.getByText("Saturn mahadasha", { exact: true })).toBeVisible();
    await expect(transitNudge.getByText("Note", { exact: true })).toBeVisible();
    expect(listFilters).toContain("eq.sent");

    await dashaNudge.getByRole("button", { name: "Explore" }).click();
    await expect.poll(() => statusUpdates).toContain("acted");
    await expect(dashaNudge).toHaveCount(0);

    await transitNudge.getByRole("button", { name: "Dismiss" }).click();
    await expect.poll(() => statusUpdates).toContain("dismissed");
    await expect(page.getByText("All quiet under the sky", { exact: true })).toBeVisible();
  });

  test("My Cosmos overview preserves core placements and Dasha entry points", async ({ page }) => {
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; report_type?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
                { name: "Sun", rasi: { id: 4, name: "Leo" }, degree: 12 },
                { name: "Moon", rasi: { id: 1, name: "Taurus" }, degree: 8 },
              ],
            },
          }),
        });
        return;
      }
      if (body.resource === "report" && body.report_type === "vimshottari_dasha") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              dasha_periods: [
                {
                  id: 6,
                  name: "Saturn",
                  start: "2020-01-01T00:00:00.000Z",
                  end: "2039-01-01T00:00:00.000Z",
                  antardasha: [],
                },
              ],
              dasha_balance: null,
            },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/home");

    await expect(
      page.getByRole("heading", { name: "Your chart, at a glance", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Ascendant", { exact: true })).toBeVisible();
    await expect(page.getByText("Aries", { exact: true })).toBeVisible();
    await expect(page.getByText("Leo", { exact: true })).toBeVisible();
    await expect(page.getByText("Taurus", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vimshottari Dasha", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "Open your Kundli" }).click();
    await expect(page).toHaveURL(/\/home\?tab=charts$/);
    await expect(page.getByRole("heading", { name: "Rashi chart (D1)", level: 2 })).toBeVisible();
  });

  test("Dasha timing narrative retains every supplied period and balance field", async ({
    page,
  }) => {
    const currentYear = new Date().getUTCFullYear();
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; report_type?: string };
      if (body.resource === "report" && body.report_type === "vimshottari_dasha") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              dasha_periods: [
                {
                  id: 6,
                  name: "Saturn",
                  start: `${currentYear - 6}-01-01T00:00:00.000Z`,
                  end: `${currentYear + 13}-12-31T00:00:00.000Z`,
                  antardasha: [
                    {
                      id: 5,
                      name: "Jupiter",
                      start: `${currentYear}-01-01T00:00:00.000Z`,
                      end: `${currentYear + 1}-12-31T00:00:00.000Z`,
                      pratyantardasha: [
                        {
                          id: 4,
                          name: "Mars",
                          start: `${currentYear}-01-01T00:00:00.000Z`,
                          end: `${currentYear}-12-31T00:00:00.000Z`,
                        },
                      ],
                    },
                  ],
                },
              ],
              dasha_balance: {
                lord: { id: 6, name: "Saturn", vedic_name: "Shani" },
                duration: "P19Y",
                description: "The balance description from the provider.",
              },
            },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/home?tab=details");

    await expect(page.getByText("Timing from your chart", { exact: true })).toBeVisible();
    await expect(
      page.getByText("These periods describe astrological timing, not guaranteed life events."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your current timing", level: 3 }),
    ).toBeVisible();
    await expect(
      page.getByText("The Saturn Mahadasha is active, with Jupiter as the current Antardasha."),
    ).toBeVisible();
    await expect(page.getByText("Mars", { exact: true })).toBeVisible();
    await expect(page.getByText("Beginning balance", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        /Dasha balance at birth: Saturn \(Shani\).*The balance description from the provider\./,
      ),
    ).toBeVisible();
    await expect(page.getByText("Full period map", { exact: true })).toBeVisible();

    const river = page.getByRole("region", { name: "Life map" });
    await expect(
      river.getByRole("button", {
        name: `Saturn, 31 Dec ${currentYear - 6} to 31 Dec ${currentYear + 13}, 19 years`,
      }),
    ).toBeVisible();
    await expect(
      river.getByRole("button", {
        name: `Jupiter Antardasha, 1 Jan ${currentYear} to 31 Dec ${currentYear + 1}`,
      }),
    ).toBeVisible();
    await expect(
      river.locator(
        `[aria-label="Mars Pratyantardasha, 1 Jan ${currentYear} to 31 Dec ${currentYear}"]`,
      ),
    ).toBeVisible();
  });

  test("Dosha cards retain source status and calculation details without alarm framing", async ({
    page,
  }) => {
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; report_type?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
                { name: "Moon", rasi: { id: 0, name: "Aries" }, degree: 8 },
              ],
            },
          }),
        });
        return;
      }
      if (body.resource === "report" && body.report_type === "mangal_dosha") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { has_dosha: true, description: "Mangal detail from the source." },
          }),
        });
        return;
      }
      if (body.resource === "report" && body.report_type === "kaal_sarp_dosha") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              has_dosha: false,
              description: "Kaal Sarp detail from the source.",
              type: "Anant",
              dosha_type: null,
            },
          }),
        });
        return;
      }
      await route.fallback();
    });
    await page.route("**/rest/v1/transit_planets*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            planet: 6,
            sign: 1,
            nakshatra: null,
            pada: null,
            retrograde: false,
            next_ingress_ts: null,
            next_sign: null,
          },
        ]),
      });
    });

    await page.goto("/home?tab=doshas");

    await expect(
      page.getByText(
        "These traditional calculations describe patterns; they do not determine outcomes.",
      ),
    ).toBeVisible();

    const mangal = page
      .getByRole("heading", { name: /Mangal Dosha/ })
      .locator("xpath=ancestor::article");
    await expect(mangal.getByText("Calculation basis:", { exact: true })).toBeVisible();
    await expect(
      mangal.getByText("Calculation basis: Mangal Dosha calculation", { exact: true }),
    ).toBeVisible();
    await expect(mangal.getByText("Present", { exact: true })).toBeVisible();
    await expect(mangal.getByText("Mangal detail from the source.", { exact: true })).toBeVisible();

    const kaalSarp = page
      .getByRole("heading", { name: "Kaal Sarp Dosha" })
      .locator("xpath=ancestor::article");
    await expect(kaalSarp.getByText("Not present", { exact: true })).toBeVisible();
    await expect(
      kaalSarp.getByText("Kaal Sarp detail from the source.", { exact: true }),
    ).toBeVisible();
    await expect(kaalSarp.getByText("Anant", { exact: true })).toBeVisible();

    const sadeSati = page
      .getByRole("heading", { name: "Sade Sati" })
      .locator("xpath=ancestor::article");
    await expect(
      sadeSati.getByText("Calculation basis: Natal Moon and current Saturn", { exact: true }),
    ).toBeVisible();
    await expect(sadeSati.getByText("Active", { exact: true })).toBeVisible();
  });

  test("remedies retain selected practice details and their ethical boundary", async ({ page }) => {
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; report_type?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
                { name: "Saturn", rasi: { id: 0, name: "Aries" }, degree: 12 },
              ],
            },
          }),
        });
        return;
      }
      if (
        body.resource === "report" &&
        (body.report_type === "mangal_dosha" || body.report_type === "kaal_sarp_dosha")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { has_dosha: false } }),
        });
        return;
      }
      await route.fallback();
    });
    await page.route("**/functions/v1/sade-sati-timeline", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, inSadeSati: false }),
      });
    });

    await page.goto("/home?tab=remedies");

    await expect(page.getByText("Optional practice", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Choose only what feels meaningful in your tradition. These practices are optional and do not guarantee a specific outcome.",
      ),
    ).toBeVisible();

    const saturnPractice = page.locator("article").filter({
      hasText: "Shani (Saturn) is in a debilitated placement in your chart.",
    });
    await expect(
      saturnPractice.getByText("Practice for reflection", { exact: true }),
    ).toBeVisible();
    await expect(saturnPractice.getByText(/Blue Sapphire \(Neelam\)/)).toBeVisible();
    await expect(
      saturnPractice.getByText("Gemstone & Rudraksha caution", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "These are traditional cultural practices offered for reflection and positivity, not medical, financial, or legal advice.",
      ),
    ).toBeVisible();
  });

  test("Ashtakavarga heatmaps retain exact bindus and totals", async ({ page }) => {
    const scores = [25, 26, 27, 28, 29, 30, 31, 26, 27, 28, 29, 31];
    const signs = [
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
    const houses = scores.map((score, index) => ({
      house: { number: index + 1, name: `House ${index + 1}` },
      rasi: { name: signs[index], lord: { name: "Lord" } },
      planets: [{ planet: { name: "Sun" }, score: 1 }],
      score,
    }));
    const bhinnaHouses = houses.map((house) => ({ ...house, score: 4 }));

    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; report_type?: string };
      if (body.resource !== "report") return route.fallback();

      if (body.report_type === "sarvashtakavarga") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { data: { sarvashtakavarga: { prastara: { houses } } } },
          }),
        });
        return;
      }

      if (body.report_type === "ashtakavarga") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { data: { ashtakavarga: { prastara: { houses: bhinnaHouses } } } },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/home?tab=ashtakavarga");

    const sarva = page
      .getByRole("heading", { name: "Sarvashtakavarga", level: 2 })
      .locator("xpath=ancestor::section[1]");
    const sarvaMap = sarva.getByRole("region", { name: "Combined house support map" });
    await expect(sarvaMap.getByLabel("House 1, Aries, 25 bindus")).toBeVisible();
    await expect(sarvaMap.getByLabel("House 12, Pisces, 31 bindus")).toBeVisible();
    await expect(sarva.getByText("Total bindus:", { exact: true }).locator("..")).toContainText(
      "337",
    );
    await expect(sarva.getByText("Exact house values", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Saturn" }).click();
    const bhinna = page
      .getByRole("heading", { name: "Bhinnashtakavarga (per planet)", level: 2 })
      .locator("xpath=ancestor::section[1]");
    const bhinnaMap = bhinna.getByRole("region", { name: "Saturn house support map" });
    await expect(bhinnaMap.getByLabel("House 1, Aries, 4 bindus")).toBeVisible();
    await expect(
      bhinna.getByText("Total bindus for Saturn:", { exact: true }).locator(".."),
    ).toContainText("48");
  });

  test("numerology keeps its source boundary and calculation output", async ({ page }) => {
    const number = (value: number, meaning: string, reduction: string) => ({
      number: value,
      meaning,
      reduction,
    });
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string };
      if (body.resource !== "numerology") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            input: { full_name: "Aarohi Journey", birth_date: "1992-08-15" },
            systems_note: "Two name-number systems are shown.",
            driver: number(2, "Driver meaning.", "11 → 2"),
            destiny: number(6, "Destiny meaning.", "33 → 6"),
            birthday: number(15, "Birthday meaning.", "15 → 6"),
            personal_year: { ...number(9, "Personal year meaning.", "2026 → 9"), year: 2026 },
            pythagorean: {
              expression: number(3, "Pythagorean expression meaning.", "30 → 3"),
              soul_urge: number(5, "Pythagorean soul meaning.", "14 → 5"),
              personality: number(7, "Pythagorean personality meaning.", "16 → 7"),
              maturity: number(8, "Pythagorean maturity meaning.", "17 → 8"),
            },
            chaldean: {
              expression: number(1, "Chaldean expression meaning.", "10 → 1"),
              soul_urge: number(4, "Chaldean soul meaning.", "13 → 4"),
              personality: number(6, "Chaldean personality meaning.", "24 → 6"),
              maturity: number(9, "Chaldean maturity meaning.", "27 → 9"),
            },
          },
        }),
      });
    });

    await page.goto("/home?tab=numerology");

    await expect(page.getByText("Numerology lens", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "These numbers are calculated through numerology from your saved birth details and name. They are separate from Jyotish chart calculations.",
      ),
    ).toBeVisible();
    await expect(page.getByText("From your birth date", { exact: true })).toBeVisible();
    await expect(page.getByText("From your saved name", { exact: true })).toBeVisible();
    await expect(page.getByText("Birth-date derived", { exact: true })).toBeVisible();
    await expect(page.getByText("Name derived", { exact: true })).toBeVisible();

    const core = page
      .getByRole("heading", { name: "Core Numbers", level: 3 })
      .locator("xpath=ancestor::section[1]");
    expect(await core.locator("span.text-4xl").allTextContents()).toEqual(["2", "6", "15", "9"]);
    await expect(core.getByText("2026 → 9", { exact: true })).toBeVisible();
    await expect(page.getByText("Pythagorean expression meaning.", { exact: true })).toBeVisible();
    await expect(page.getByText("Pythagorean maturity meaning.", { exact: true })).toBeVisible();
    await expect(page.getByText("Chaldean expression meaning.", { exact: true })).toBeVisible();
    await expect(page.getByText("Chaldean maturity meaning.", { exact: true })).toBeVisible();
  });

  test("Lo Shu construction retains grid, missing, and repeated values", async ({ page }) => {
    const gridNumbers = [
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6],
    ];
    const grid = gridNumbers.map((row) =>
      row.map((number) => ({
        number,
        count: number === 1 ? 2 : number === 4 || number === 9 ? 1 : 0,
        digits: number === 1 ? "11" : number === 4 || number === 9 ? String(number) : "",
        meaning: `Meaning ${number}`,
      })),
    );
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string };
      if (body.resource !== "lo_shu") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            data: {
              grid,
              counts: { "1": 2, "4": 1, "9": 1 },
              present: [1, 4, 9],
              missing: [2, 3, 5, 6, 7, 8],
              repeated: [1],
              repeated_details: [
                {
                  number: 1,
                  count: 2,
                  digits: "11",
                  level: "repeated",
                  note: "Repeated one note.",
                  meaning: "Repeated one meaning.",
                },
              ],
              driver: 1,
              destiny: 9,
              arrows: [],
              meanings: Object.fromEntries(
                Array.from({ length: 9 }, (_, index) => [
                  String(index + 1),
                  `Meaning ${index + 1}`,
                ]),
              ),
              kua: { available: false },
            },
          },
        }),
      });
    });

    await page.goto("/home?tab=loshu");

    const loshuGrid = page.getByRole("grid", { name: "Lo Shu grid" });
    await expect(loshuGrid.locator(".as-loshu-grid-cell")).toHaveCount(9);
    await expect(loshuGrid.getByLabel("4: Meaning 4 (x1)")).toBeVisible();
    await expect(loshuGrid.getByLabel("1: Meaning 1 (x2)")).toBeVisible();
    await expect(loshuGrid.getByLabel("2: Meaning 2 — empty")).toBeVisible();
    await expect
      .poll(() =>
        loshuGrid
          .locator(".as-loshu-grid-cell")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe("as-loshu-cell-reveal");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        loshuGrid
          .locator(".as-loshu-grid-cell")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe("none");

    await page.getByRole("button", { name: "Missing numbers 6", exact: true }).click();
    await expect(page.getByText("Meaning 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Repeated / intensified 1", exact: true }).click();
    await expect(page.getByText("Repeated one note.", { exact: true })).toBeVisible();
  });

  test("Kundli keeps provider SVG styles and synchronizes its accessible house selection", async ({
    page,
  }, testInfo) => {
    const requestedStyles: string[] = [];
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; chart_style?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
                { name: "Sun", rasi: { id: 2, name: "Gemini" }, degree: 12 },
              ],
            },
          }),
        });
        return;
      }
      if (body.chart_style) {
        requestedStyles.push(body.chart_style);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            svg: `<svg data-provider-style="${body.chart_style}" viewBox="0 0 480 480"><text>Provider ${body.chart_style}</text></svg>`,
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/home?tab=charts");

    await expect(page.locator('svg[data-provider-style="north_indian"]')).toBeVisible();
    const selection = page.getByRole("region", { name: "Select a house" });
    await expect(selection.getByRole("button", { name: /House/ })).toHaveCount(12);

    const houseThree = selection.getByRole("button", { name: /House 3.*Gemini/ });
    await houseThree.click();
    await expect(houseThree).toHaveAttribute("aria-pressed", "true");
    await expect(
      selection.getByRole("heading", { name: "House 3 · Gemini", level: 3 }),
    ).toBeVisible();

    const isMobile = testInfo.project.name === "mobile-chrome";
    const chartStyle = page.getByRole("combobox", { name: "Chart style", exact: true });
    if (isMobile) {
      await page.getByRole("button", { name: "Chart style" }).click();
      await page.getByRole("option", { name: "South Indian" }).click();
    } else {
      await chartStyle.selectOption("south");
    }
    await expect(page.locator('svg[data-provider-style="south_indian"]')).toBeVisible();
    if (isMobile) {
      await page.getByRole("button", { name: "Chart style" }).click();
      await page.getByRole("option", { name: "East Indian" }).click();
    } else {
      await chartStyle.selectOption("east");
    }
    await expect(page.locator('svg[data-provider-style="east_indian"]')).toBeVisible();
    expect(requestedStyles).toEqual(
      expect.arrayContaining(["north_indian", "south_indian", "east_indian"]),
    );
  });

  test("chart inspectors hand exact house and planet facts to Ask", async ({ page }) => {
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; chart_style?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0, longitude: 0 },
                { name: "Sun", rasi: { id: 2, name: "Gemini" }, degree: 12, longitude: 72 },
              ],
            },
          }),
        });
        return;
      }
      if (body.chart_style) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ svg: '<svg viewBox="0 0 480 480" />' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/home?tab=charts");

    const selection = page.getByRole("region", { name: "Select a house" });
    await selection.getByRole("button", { name: /House 3.*Gemini/ }).click();
    await selection.getByRole("button", { name: /Ask about this D1.*house/ }).click();
    await expect(page.getByRole("textbox", { name: "Message AstroSaathi" })).toHaveValue(
      "Tell me about house 3 in my D1 · Rashi (birth) chart — it's in Gemini, ruled by Mercury, with Sun placed there. What does this mean for me?",
    );

    await page.goto("/home?tab=charts");
    await page.getByRole("button", { name: /Planets/ }).click();
    const sunCard = page.locator("li").filter({ has: page.getByText("Sun", { exact: true }) });
    await sunCard.getByRole("button", { name: "Inspect" }).click();
    await expect(page.getByRole("heading", { name: "Sun · Gemini", level: 2 })).toHaveCount(0);
    await expect(sunCard.getByRole("button", { name: "Ask about this placement" })).toBeVisible();
    await sunCard.getByRole("button", { name: "Ask about this placement" }).click();
    await expect(page.getByRole("textbox", { name: "Message AstroSaathi" })).toHaveValue(
      "Tell me about Sun in my D1 · Rashi (birth) chart — it is in Gemini, house 3, with nakshatra Ardra. What does this placement mean for me?",
    );
  });

  test("Varga explorer retains every supported mapping and label", async ({ page }, testInfo) => {
    const requestedChartTypes: string[] = [];
    await page.route("**/functions/v1/chart-gateway", async (route) => {
      const body = route.request().postDataJSON() as { resource?: string; chart_type?: string };
      if (body.resource === "planets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              planet_position: [
                { name: "Ascendant", rasi: { id: 0, name: "Aries" }, degree: 0 },
                { name: "Sun", rasi: { id: 2, name: "Gemini" }, degree: 12 },
              ],
            },
          }),
        });
        return;
      }
      if (body.chart_type) {
        requestedChartTypes.push(body.chart_type);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            svg: `<svg data-provider-chart-type="${body.chart_type}" viewBox="0 0 480 480"><text>${body.chart_type}</text></svg>`,
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/home?tab=charts");

    const isMobile = testInfo.project.name === "mobile-chrome";
    const picker = page.getByRole("combobox", { name: "Divisional chart", exact: true });
    if (!isMobile) await expect(picker.locator("option")).toHaveCount(VARGA_KEYS.length);
    await page.getByRole("button", { name: "D9 · Navamsa" }).click();
    if (isMobile) {
      await page.getByRole("button", { name: "Divisional chart" }).click();
      await page.getByRole("option", { name: "D9 · Navamsa" }).click();
    } else {
      await expect(picker).toHaveValue("D9");
    }
    await expect.poll(() => requestedChartTypes).toContain(EXPECTED_VARGA_ENUMS.D9);

    for (const varga of VARGA_KEYS) {
      if (isMobile) {
        await page.getByRole("button", { name: /Divisional chart/ }).click();
        await page.getByRole("option", { name: new RegExp(`^${varga} ·`) }).click();
      } else {
        await picker.selectOption(varga);
      }
      await expect.poll(() => requestedChartTypes).toContain(EXPECTED_VARGA_ENUMS[varga]);
    }

    await expect(
      page.getByText("Currently viewing: D60 · Shashtyamsa (overall karma)"),
    ).toBeVisible();
  });

  test("people rows expose chart, Ask, and compatibility quick actions", async ({ page }) => {
    await page.goto("/people");
    const person = page.getByRole("listitem").filter({ hasText: "Vihaan Journey" });

    await expect(
      person.getByRole("link", { name: "Open Vihaan Journey's chart", exact: true }),
    ).toHaveAttribute("href", new RegExp(`/people/${TEST_PERSON_ID}/?$`));
    await expect(
      person.getByRole("link", { name: "Ask about Vihaan Journey", exact: true }),
    ).toHaveAttribute("href", /\/chat\?/);
    await expect(
      person.getByRole("link", { name: "Compare with Vihaan Journey", exact: true }),
    ).toHaveAttribute("href", new RegExp(`/people/${TEST_PERSON_ID}/compatibility/?$`));
  });

  test("people collection stays compact and grouped on mobile", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Mobile collection geometry is mobile-only.",
    );

    await page.goto("/people");
    const list = page.getByRole("list").filter({ hasText: "Vihaan Journey" }).first();
    const person = list.getByRole("listitem").filter({ hasText: "Vihaan Journey" });

    await expect(list).toBeVisible();
    await expect(person).toBeVisible();
    const listStyle = await list.evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTopStyle: style.borderTopStyle, overflow: style.overflow };
    });
    expect(listStyle).toEqual({ borderTopStyle: "solid", overflow: "hidden" });

    const box = await person.boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(180);
  });

  test("people add and edit forms open as native mobile sheets", async ({ page }) => {
    for (const personForm of [
      { path: "/people/new", name: "Add a person" },
      { path: `/people/${TEST_PERSON_ID}/edit`, name: "Edit person" },
    ]) {
      await page.goto(personForm.path);

      const sheet = page.getByRole("dialog", { name: personForm.name });
      await expect(sheet).toBeVisible();
      const geometry = await sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, top: rect.top, viewportHeight: window.innerHeight };
      });
      expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
      expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);
      await expect(page.getByLabel("Full name")).toBeVisible();
    }
  });

  test("journal reflection editor opens as a native mobile sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Native sheet geometry is mobile-only.");

    await page.goto("/journal");
    await expect(page.getByRole("heading", { name: "Reflection Journal", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "New reflection" }).click();

    const sheet = page.getByRole("dialog", { name: "New reflection" });
    await expect(sheet).toBeVisible();
    const geometry = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top, viewportHeight: window.innerHeight };
    });
    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
    expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);
    await expect(page.getByLabel("What happened, what shifted")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("Journey to Ask context opens as a native mobile sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Native sheet geometry is mobile-only.");

    await page.route("**/rest/v1/user_reflection_journal**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "00000000-0000-4000-8000-000000000201",
            user_id: "00000000-0000-4000-8000-000000000001",
            entry_date: "2026-09-18",
            title: "A turning point",
            content: "I chose a calmer response today.",
            mood: "calm",
            tags: ["reflection"],
            astro_context: {},
            context_status: "pending",
            created_at: "2026-09-18T08:00:00.000Z",
            updated_at: "2026-09-18T08:00:00.000Z",
          },
        ]),
      });
    });

    await page.goto("/journal");
    await page.getByRole("button", { name: "Ask about this reflection" }).click();

    const sheet = page.getByRole("dialog", { name: "Ask with this context?" });
    await expect(sheet).toBeVisible();
    const geometry = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top, viewportHeight: window.innerHeight };
    });
    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
    expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);
    await expect(page.getByRole("button", { name: "Continue to Ask" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("Journey empty timeline offers a first milestone action on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Journey first-action geometry is mobile-only.",
    );

    await page.goto("/journey");
    const timeline = page.getByRole("article").filter({ hasText: "Life timeline" }).first();
    await expect(timeline).toBeVisible();
    await expect(timeline.getByRole("link", { name: "Add milestone" })).toBeVisible();
    await expect(timeline.getByText(/Start with a milestone like a job/)).toBeVisible();

    const box = await timeline.boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(280);
  });

  test("life timeline templates prefill a new milestone without changing the form flow", async ({
    page,
  }) => {
    await page.goto("/life");
    await page.getByRole("button", { name: "Add milestone" }).click();

    const form = page.getByRole("dialog", { name: "Add milestone" });
    await expect(form).toBeVisible();
    const geometry = await form.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top, viewportHeight: window.innerHeight };
    });
    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
    expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);

    await expect(page.getByRole("heading", { name: "Start with a template" })).toBeVisible();
    await page.getByRole("button", { name: "Job or role" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Started a new job or role");
    await expect(page.getByLabel("Category")).toHaveValue("career");
  });

  test("people opens a synthetic saved person and exposes compatibility", async ({ page }) => {
    await page.goto("/people");
    await page
      .getByRole("link", { name: /Vihaan Journey/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/people/${TEST_PERSON_ID}/?$`));
    await expect(page.getByRole("link", { name: /Compatibility/ })).toBeVisible();
  });

  test("person chart Varga selection opens as a native mobile sheet", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Native sheet geometry is mobile-only.");

    await page.goto(`/people/${TEST_PERSON_ID}`);

    const picker = page.getByRole("button", { name: "Divisional chart" });
    await expect(picker).toBeVisible();
    await picker.click();

    const sheet = page.getByRole("dialog", { name: "Divisional chart" });
    await expect(sheet).toBeVisible();
    const geometry = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top, viewportHeight: window.innerHeight };
    });
    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.viewportHeight - 12);
    expect(geometry.top).toBeGreaterThan(geometry.viewportHeight * 0.1);

    await sheet.getByRole("option", { name: "D9 · Navamsa" }).click();
    await expect(sheet).toBeHidden();
    await expect(picker).toContainText("D9 · Navamsa");
  });
});
