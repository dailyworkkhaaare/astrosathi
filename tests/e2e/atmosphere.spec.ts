import { expect, test } from "@playwright/test";

test("Dawn and Midnight atmospheres switch without layout overflow", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const dawn = await page.locator(".as-atmosphere").evaluate((shell) => {
    const style = getComputedStyle(shell);
    const grain = getComputedStyle(shell, "::before");
    return {
      backgroundImage: style.backgroundImage,
      grainImage: grain.backgroundImage,
      grainOpacity: grain.opacity,
      grainAnimation: grain.animationName,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(dawn.backgroundImage).toContain("radial-gradient");
  expect(dawn.backgroundImage).toContain("82% -10%");
  expect(dawn.grainImage).toContain("data:image/svg+xml");
  expect(dawn.grainOpacity).toBe("0.018");
  expect(dawn.grainAnimation).toBe("none");
  expect(dawn.overflow).toBe(false);

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const midnight = await page.locator(".as-atmosphere").evaluate((shell) => {
    const style = getComputedStyle(shell);
    const grain = getComputedStyle(shell, "::before");
    return {
      backgroundImage: style.backgroundImage,
      grainOpacity: grain.opacity,
    };
  });

  expect(midnight.backgroundImage).toContain("16% 0%");
  expect(midnight.backgroundImage).not.toBe(dawn.backgroundImage);
  expect(midnight.grainOpacity).toBe("0.028");
});

test("atmospheric texture yields to accessibility preferences", async ({ page }) => {
  await page.emulateMedia({ contrast: "more", reducedMotion: "reduce" });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const highContrast = await page.locator(".as-atmosphere").evaluate((shell) => {
    const grain = getComputedStyle(shell, "::before");
    return {
      grainOpacity: grain.opacity,
      grainAnimation: grain.animationName,
    };
  });

  expect(highContrast).toEqual({ grainOpacity: "0", grainAnimation: "none" });

  await page.emulateMedia({ forcedColors: "active" });
  const forcedColors = await page.locator(".as-atmosphere").evaluate((shell) => {
    const style = getComputedStyle(shell);
    const grain = getComputedStyle(shell, "::before");
    return {
      backgroundImage: style.backgroundImage,
      grainOpacity: grain.opacity,
    };
  });

  expect(forcedColors).toEqual({ backgroundImage: "none", grainOpacity: "0" });
});
