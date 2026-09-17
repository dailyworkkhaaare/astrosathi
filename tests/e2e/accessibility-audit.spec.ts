import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession, installSupabaseMock } from "./support/mock-supabase";

const authenticatedRoutes = ["/today", "/home", "/chat", "/journey", "/people", "/settings"];

test("representative routes expose named controls and core landmarks", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await installAuthenticatedSession(context, { locale: "en", theme: "light" });
  await installSupabaseMock(page);

  for (const path of authenticatedRoutes) {
    await page.goto(path);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/chat" || path === "/journey") {
      await expect(
        page.locator('[aria-live], [role="status"], [role="log"]').first(),
      ).toBeAttached();
    }

    const violations = await page.evaluate(() => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      };
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim();
      const name = (element: Element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        const labels =
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
            ? [...element.labels].map(text).join(" ").trim()
            : "";
        return (
          element.getAttribute("aria-label") ||
          (labelledBy ? text(document.getElementById(labelledBy)) : "") ||
          labels ||
          element.getAttribute("alt") ||
          element.getAttribute("title") ||
          text(element)
        );
      };
      const controls = [
        ...document.querySelectorAll(
          'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]',
        ),
      ].filter(visible);
      const unnamedControls = controls
        .filter((element) => !name(element))
        .map((element) => element.outerHTML.slice(0, 180));
      const imagesWithoutAlt = [...document.querySelectorAll("img")]
        .filter(visible)
        .filter((image) => !image.hasAttribute("alt"))
        .map((image) => image.outerHTML.slice(0, 180));
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

      return { unnamedControls, imagesWithoutAlt, duplicateIds: [...new Set(duplicateIds)] };
    });

    expect(violations, `${path} semantic violations`).toEqual({
      unnamedControls: [],
      imagesWithoutAlt: [],
      duplicateIds: [],
    });
  }
});

test("keyboard focus remains visible on key signed-out and signed-in routes", async ({
  context,
  page,
}) => {
  await installSupabaseMock(page);

  await page.goto("/auth");
  await assertVisibleKeyboardFocus(page, "/auth");

  await installAuthenticatedSession(context, { locale: "en", theme: "light" });
  for (const path of ["/today", "/chat", "/settings"]) {
    await page.goto(path);
    await assertVisibleKeyboardFocus(page, path);
  }
});

async function assertVisibleKeyboardFocus(page: Page, path: string) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  let checked = 0;
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
      };
    });
    if (!focus && checked > 0) break;
    expect(focus, `${path} initial tab has a focus target`).not.toBeNull();
    expect(focus?.visible, `${path} tab ${index + 1} has visible focus`).toBe(true);
    checked += 1;
  }
  expect(checked, `${path} keyboard focus targets checked`).toBeGreaterThan(0);
}

test("mobile controls meet the 44px product target or use an inline-text exception", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 800 });
  await installAuthenticatedSession(context, { locale: "en", theme: "light" });
  await installSupabaseMock(page);

  for (const path of authenticatedRoutes) {
    await page.goto(path);
    const undersized = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]',
        ),
      ]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight) {
            return false;
          }
          if (element.tagName === "A" && getComputedStyle(element).display === "inline")
            return false;
          return true;
        })
        .map((element) => {
          const target =
            element instanceof HTMLInputElement && element.labels.length > 0
              ? element.labels[0]
              : element;
          const rect = target.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ||
              element.textContent?.replace(/\s+/g, " ").trim() ||
              element.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((target) => target.width < 44 || target.height < 44),
    );

    expect(undersized, `${path} undersized mobile targets`).toEqual([]);
  }
});

test("semantic colours meet WCAG AA and reduced motion becomes effectively static", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await assertSemanticContrast(page, "light");

  const motion = await page.evaluate(() => {
    const durations = [...document.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element);
      return [...style.animationDuration.split(","), ...style.transitionDuration.split(",")].map(
        (value) =>
          value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000,
      );
    });
    return Math.max(...durations);
  });
  expect(motion).toBeLessThanOrEqual(1);

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await assertSemanticContrast(page, "dark");
});

async function assertSemanticContrast(page: Page, theme: string) {
  const ratios = await page.evaluate(() => {
    const pairs = [
      ["--background", "--foreground"],
      ["--card", "--card-foreground"],
      ["--muted", "--muted-foreground"],
      ["--primary", "--primary-foreground"],
    ] as const;
    const rgb = (token: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const luminance = (colour: number[]) =>
      colour
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

    return pairs.map(([background, foreground]) => {
      const values = [luminance(rgb(background)), luminance(rgb(foreground))].sort((a, b) => b - a);
      return {
        pair: `${foreground} on ${background}`,
        ratio: (values[0] + 0.05) / (values[1] + 0.05),
      };
    });
  });

  for (const result of ratios) {
    expect(result.ratio, `${theme}: ${result.pair}`).toBeGreaterThanOrEqual(4.5);
  }
}
