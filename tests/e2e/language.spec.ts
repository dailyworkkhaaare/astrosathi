import { expect, test } from "@playwright/test";

import { installClientPreferences } from "./support/mock-supabase";

test.beforeEach(async ({ context }) => {
  await installClientPreferences(context, { locale: "en", theme: "light" });
});

test("language selection preserves the existing persistence and continue contract", async ({
  page,
}) => {
  await page.goto("/language");

  const english = page.getByRole("radio", { name: "English — English" });
  const hindi = page.getByRole("radio", { name: "हिन्दी — Hindi" });
  const marathi = page.getByRole("radio", { name: "मराठी — Marathi" });

  await expect(english).toHaveAttribute("aria-checked", "true");
  await hindi.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(hindi).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("heading", { level: 1, name: "सितारे आपकी भाषा बोलते हैं।" }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("astrosaathi.lang"))).toBe("hi");
  await expectNoHorizontalOverflow(page);

  await marathi.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await expect(marathi).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("heading", { level: 1, name: "तारे तुमची भाषा बोलतात." }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("astrosaathi.lang"))).toBe("mr");
  await expectNoHorizontalOverflow(page);

  await expect(page.getByRole("link", { name: "पुढे जा" })).toHaveAttribute("href", "/auth");
});

test("language experience is complete and viewport-safe", async ({ page }) => {
  await page.goto("/language");

  await expect(
    page.getByRole("heading", { level: 1, name: "The stars speak your language." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Choose your language" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);

  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}
