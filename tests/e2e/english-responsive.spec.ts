import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  installClientPreferences,
  installSupabaseMock,
  TEST_PERSON_ID,
} from "./support/mock-supabase";

type AuditRoute = {
  path: string;
};

const viewports = [
  { name: "phone-320", width: 320, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 1100 },
];

const publicRoutes: AuditRoute[] = [
  { path: "/" },
  { path: "/language" },
  { path: "/auth" },
  { path: "/terms" },
  { path: "/privacy" },
];

const authenticatedRoutes: AuditRoute[] = [
  { path: "/today" },
  { path: "/today/horoscope" },
  { path: "/today/panchang" },
  { path: "/today/markets" },
  { path: "/home" },
  { path: "/chat" },
  { path: "/journey" },
  { path: "/people" },
  { path: `/people/${TEST_PERSON_ID}` },
  { path: `/people/${TEST_PERSON_ID}/compatibility` },
  { path: "/settings" },
  { path: "/settings/preferences" },
  { path: "/settings/memory" },
  { path: "/settings/proactive" },
  { path: "/settings/voice" },
];

test.describe("English responsive audit", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} public routes stay within the viewport`, async ({ context, page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.clock.setFixedTime(new Date("2026-09-15T06:30:00.000Z"));
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      await installClientPreferences(context, { locale: "en", theme: "light" });
      await installSupabaseMock(page);

      for (const route of publicRoutes) {
        await page.goto(route.path);
        await assertViewportSafe(page, route.path, viewport.name);
      }
    });

    test(`${viewport.name} authenticated routes stay within the viewport`, async ({
      context,
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.clock.setFixedTime(new Date("2026-09-15T06:30:00.000Z"));
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      await installAuthenticatedSession(context, { locale: "en", theme: "light" });
      await installSupabaseMock(page);

      for (const route of authenticatedRoutes) {
        await page.goto(route.path);
        await assertViewportSafe(page, route.path, viewport.name);
      }
    });
  }
});

async function assertViewportSafe(
  page: import("@playwright/test").Page,
  path: string,
  viewportName: string,
) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.evaluate(() => document.fonts.ready);

  const audit = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const overflow = root.scrollWidth - viewportWidth;
    const visibleControls = [...document.querySelectorAll("button, a, input, select")].filter(
      (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight;
      },
    );
    const crampedControls = visibleControls
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.replace(/\s+/g, " ").trim() ||
            element.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((control) => control.height < 32 || control.width < 32);

    return { overflow, viewportWidth, documentWidth: root.scrollWidth, crampedControls };
  });

  expect(audit.overflow, `${path} overflow at ${viewportName}`).toBeLessThanOrEqual(1);
  expect(audit.crampedControls, `${path} cramped controls at ${viewportName}`).toEqual([]);
}
