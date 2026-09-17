import { expect, test } from "@playwright/test";

import { installClientPreferences, type TestLocale } from "./support/mock-supabase";

const COPY: Record<TestLocale, { title: string; story: string; features: string; trust: string }> =
  {
    en: {
      title: "Read your chart. Ask what matters.",
      story: "A personal reading, without the mystery",
      features: "More than a chart on a screen",
      trust: "Built for reflection, not fear",
    },
    hi: {
      title: "अपनी कुंडली समझें। जो मायने रखता है, पूछें।",
      story: "आपके लिए एक सरल, व्यक्तिगत अनुभव",
      features: "स्क्रीन पर बनी कुंडली से कहीं अधिक",
      trust: "आत्मचिंतन के लिए, डर के लिए नहीं",
    },
    mr: {
      title: "तुमची कुंडली समजा. महत्त्वाचे प्रश्न विचारा.",
      story: "तुमच्यासाठी सोपा, वैयक्तिक अनुभव",
      features: "स्क्रीनवरील कुंडलीपेक्षा बरेच काही",
      trust: "आत्मचिंतनासाठी, भीतीसाठी नाही",
    },
  };

for (const locale of Object.keys(COPY) as TestLocale[]) {
  test(`${locale} landing is complete and fits the viewport`, async ({ context, page }) => {
    await installClientPreferences(context, {
      locale,
      theme: locale === "hi" ? "dark" : "light",
    });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1, name: COPY[locale].title })).toBeVisible();
    await expect(page.getByRole("heading", { name: COPY[locale].story })).toBeVisible();
    await expect(page.getByRole("heading", { name: COPY[locale].features })).toBeVisible();
    await expect(page.getByRole("heading", { name: COPY[locale].trust })).toBeVisible();
    await expect(page.getByTestId("kundli-chat-preview")).toBeVisible();

    await expect(page.locator('a[href="/language"]').first()).toBeVisible();
    await expect(page.locator('a[href="/auth"]').first()).toBeVisible();

    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  });
}

test("landing preview is lightweight and clearly non-live", async ({ page }) => {
  await page.goto("/");

  const preview = page.getByTestId("kundli-chat-preview");
  await expect(preview).toHaveAttribute("role", "img");
  await expect(preview).toHaveAttribute("aria-label", /Illustrative product preview/);
  await expect(preview.getByText("Illustrative", { exact: true })).toBeVisible();
  await expect(page.locator("video, canvas")).toHaveCount(0);
  await expect(page.locator('img[src^="http"]')).toHaveCount(0);
});
