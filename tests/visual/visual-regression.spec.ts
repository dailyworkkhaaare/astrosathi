import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  installClientPreferences,
  installSupabaseMock,
  TEST_PERSON_ID,
  type TestLocale,
  type TestTheme,
} from "../e2e/support/mock-supabase";

type VisualCase = {
  name: string;
  path: string;
  viewport: { width: number; height: number };
  locale: TestLocale;
  theme: TestTheme;
  readyText: string;
  authenticated: boolean;
};

const cases: VisualCase[] = [
  {
    name: "01-landing-compact-en-light",
    path: "/",
    viewport: { width: 320, height: 800 },
    locale: "en",
    theme: "light",
    readyText: "Discover your Vedic path",
    authenticated: false,
  },
  {
    name: "02-language-mobile-mr-light",
    path: "/language",
    viewport: { width: 390, height: 844 },
    locale: "mr",
    theme: "light",
    readyText: "तुमची भाषा निवडा",
    authenticated: false,
  },
  {
    name: "03-auth-desktop-hi-dark",
    path: "/auth",
    viewport: { width: 1440, height: 1100 },
    locale: "hi",
    theme: "dark",
    readyText: "वापसी पर स्वागत है",
    authenticated: false,
  },
  {
    name: "04-chart-desktop-en-light",
    path: "/home",
    viewport: { width: 1440, height: 1100 },
    locale: "en",
    theme: "light",
    readyText: "Your chart",
    authenticated: true,
  },
  {
    name: "05-today-mobile-mr-dark",
    path: "/today",
    viewport: { width: 390, height: 844 },
    locale: "mr",
    theme: "dark",
    readyText: "आज",
    authenticated: true,
  },
  {
    name: "06-chat-compact-hi-dark",
    path: "/chat",
    viewport: { width: 320, height: 800 },
    locale: "hi",
    theme: "dark",
    readyText: "आज आपकी कुंडली के बारे में कैसे मदद करूँ?",
    authenticated: true,
  },
  {
    name: "07-people-mobile-en-light",
    path: "/people",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "light",
    readyText: "People",
    authenticated: true,
  },
  {
    name: "08-compatibility-desktop-hi-dark",
    path: `/people/${TEST_PERSON_ID}/compatibility`,
    viewport: { width: 1440, height: 1100 },
    locale: "hi",
    theme: "dark",
    readyText: "कुंडली मिलान",
    authenticated: true,
  },
  {
    name: "09-journey-desktop-mr-light",
    path: "/life",
    viewport: { width: 1440, height: 1100 },
    locale: "mr",
    theme: "light",
    readyText: "जीवन कालरेषा",
    authenticated: true,
  },
  {
    name: "10-settings-compact-en-dark",
    path: "/settings",
    viewport: { width: 320, height: 800 },
    locale: "en",
    theme: "dark",
    readyText: "Settings",
    authenticated: true,
  },
];

test.describe("pre-redesign visual anchors", () => {
  for (const visual of cases) {
    test(visual.name, async ({ context, page }) => {
      await page.setViewportSize(visual.viewport);
      await page.clock.setFixedTime(new Date("2026-09-08T06:30:00.000Z"));
      await page.emulateMedia({ colorScheme: visual.theme, reducedMotion: "reduce" });

      if (visual.authenticated) {
        await installAuthenticatedSession(context, {
          locale: visual.locale,
          theme: visual.theme,
        });
      } else {
        await installClientPreferences(context, {
          locale: visual.locale,
          theme: visual.theme,
        });
      }
      await installSupabaseMock(page);

      await page.goto(visual.path);
      await expect(page.getByText(visual.readyText, { exact: true }).first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", visual.locale);
      if (visual.theme === "dark") {
        await expect(page.locator("html")).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/);
      }
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${visual.name}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        maxDiffPixelRatio: 0.005,
        scale: "css",
      });
    });
  }
});
