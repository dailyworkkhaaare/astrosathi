import { expect, test } from "@playwright/test";

const stateLabels = {
  en: { loading: "Loading…", empty: "Nothing here yet", error: "Something went wrong" },
  hi: { loading: "लोड हो रहा है…", empty: "यहाँ अभी कुछ नहीं है", error: "कुछ गड़बड़ हो गई" },
  mr: { loading: "लोड होत आहे…", empty: "इथे अजून काहीही नाही", error: "काहीतरी चूक झाली" },
} as const;

async function mountMatrix(
  page: import("@playwright/test").Page,
  language: keyof typeof stateLabels,
) {
  await page.evaluate(async (locale) => {
    const target = document.createElement("div");
    target.id = "state-matrix";
    document.body.replaceChildren(target);
    const { mountStateMatrix } = await import("/tests/e2e/support/state-harness.tsx");
    await mountStateMatrix(target, locale);
  }, language);
}

test("shared state matrix preserves semantics, scopes and retry ownership", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await mountMatrix(page, "en");

  const loading = page.locator('[data-state="loading"]');
  const empty = page.locator('[data-state="empty"]');
  const errors = page.locator('[data-state="error"]');

  await expect(loading).toHaveAttribute("role", "status");
  await expect(loading).toHaveAttribute("aria-live", "polite");
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toHaveAttribute("data-scope", "inline");
  await expect(empty).toHaveAttribute("data-scope", "panel");
  await expect(errors.first()).toHaveAttribute("role", "alert");
  await expect(errors.first()).toHaveAttribute("aria-live", "assertive");
  await expect(errors.first()).toHaveAttribute("data-scope", "page");

  await expect(errors.first().getByRole("button", { name: "Try again" })).toHaveCount(1);
  await expect(page.locator("[data-without-retry]").getByRole("button")).toHaveCount(0);
  await errors.first().getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#state-matrix")).toHaveAttribute("data-retry-count", "1");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("shared state labels and layouts remain resilient in every supported language", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const language of ["en", "hi", "mr"] as const) {
    await mountMatrix(page, language);
    const labels = stateLabels[language];
    await expect(page.getByRole("heading", { name: labels.loading })).toBeVisible();
    await expect(page.getByRole("heading", { name: labels.empty })).toBeVisible();
    await expect(page.getByRole("heading", { name: labels.error }).first()).toBeVisible();
    await expect(page.locator(".as-state-orbit-dot")).toHaveCSS("animation-name", "none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  }
});
