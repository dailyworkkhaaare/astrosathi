import { expect, test } from "@playwright/test";

import { installAuthenticatedSession, installSupabaseMock } from "./support/mock-supabase";

const routes = ["/today", "/home", "/chat", "/journey", "/people", "/settings"];

test("representative routes stay within runtime performance guardrails", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addInitScript(() => {
    const auditWindow = window as Window & {
      __layoutShift?: number;
      __layoutShiftSources?: string[];
    };
    auditWindow.__layoutShift = 0;
    auditWindow.__layoutShiftSources = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput: boolean;
          sources?: { node?: Node | null }[];
          value: number;
        };
        if (!shift.hadRecentInput) {
          auditWindow.__layoutShift! += shift.value;
          auditWindow.__layoutShiftSources!.push(
            ...(shift.sources ?? []).map((source) =>
              source.node instanceof Element
                ? `${source.node.tagName.toLowerCase()}${source.node.id ? `#${source.node.id}` : ""}.${[...source.node.classList].slice(0, 3).join(".")}`
                : "unknown",
            ),
          );
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await installAuthenticatedSession(context, { locale: "en", theme: "light" });
  await installSupabaseMock(page);

  // Vite's on-demand development transforms are not part of production runtime performance.
  for (const path of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  for (const path of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

    const metrics = await page.evaluate(() => {
      const auditWindow = window as Window & {
        __layoutShift?: number;
        __layoutShiftSources?: string[];
      };
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight;
      };
      const infiniteAnimations = document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
        .filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return target instanceof Element && visible(target);
        });
      const animatedFilters = document.getAnimations().filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return effect
          ?.getKeyframes()
          .some((frame) => "filter" in frame || "backdropFilter" in frame);
      });
      const imageIssues = [...document.images]
        .filter(
          (image) => image.getBoundingClientRect().top > innerHeight && image.loading !== "lazy",
        )
        .map((image) => image.currentSrc || image.src);

      return {
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        layoutShift: auditWindow.__layoutShift ?? 0,
        layoutShiftSources: auditWindow.__layoutShiftSources ?? [],
        infiniteAnimations: infiniteAnimations.length,
        animatedFilters: animatedFilters.length,
        imageIssues,
      };
    });

    expect(metrics.domContentLoadedMs, `${path} DOM content loaded`).toBeLessThan(5_000);
    expect(
      metrics.layoutShift,
      `${path} cumulative layout shift: ${metrics.layoutShiftSources.join(", ")}`,
    ).toBeLessThanOrEqual(0.1);
    expect(metrics.infiniteAnimations, `${path} visible ambient animations`).toBeLessThanOrEqual(1);
    expect(metrics.animatedFilters, `${path} filter animations`).toBe(0);
    expect(metrics.imageIssues, `${path} offscreen eager images`).toEqual([]);
  }
});
