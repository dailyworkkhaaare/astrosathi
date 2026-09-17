import { expect, test } from "@playwright/test";

async function mountMotionSpecimens(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const host = document.createElement("section");
    host.dataset.motionSpecimens = "true";
    host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden";
    host.innerHTML = `
      <button data-motion="control" class="motion-control tap-press">Control</button>
      <div data-motion="local" class="motion-local-enter">Local</div>
      <div data-motion="spatial" class="motion-spatial-from-end">Spatial</div>
      <div data-motion="ceremonial" class="motion-ceremonial">Ceremonial</div>
      <div data-motion="ambient" class="motion-glow-pulse">Ambient</div>
    `;
    document.body.append(host);
  });
}

test("motion tiers use approved durations, distances and bounded ambient work", async ({
  page,
}) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await mountMotionSpecimens(page);

  const motion = await page.evaluate(() => {
    const read = (name: string) => {
      const element = document.querySelector<HTMLElement>(`[data-motion="${name}"]`)!;
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationIterationCount: style.animationIterationCount,
        transitionDuration: style.transitionDuration,
        transitionProperty: style.transitionProperty,
      };
    };
    return {
      control: read("control"),
      local: read("local"),
      spatial: read("spatial"),
      ceremonial: read("ceremonial"),
      ambient: read("ambient"),
      localDistance: getComputedStyle(document.documentElement)
        .getPropertyValue("--as-motion-distance-local")
        .trim(),
      worldDistance: getComputedStyle(document.documentElement)
        .getPropertyValue("--as-motion-distance-world")
        .trim(),
    };
  });

  expect(motion.control.transitionProperty).not.toContain("all");
  expect(motion.control.transitionDuration).toContain("0.11s");
  expect(motion.local.animationDuration).toBe("0.3s");
  expect(motion.spatial.animationDuration).toBe("0.42s");
  expect(motion.ceremonial.animationDuration).toBe("1.4s");
  expect(motion.ambient.animationDuration).toBe("4.8s");
  expect(motion.ambient.animationIterationCount).toBe("1");
  expect(motion.localDistance).toMatch(/rem$/);
  expect(motion.worldDistance).toMatch(/rem$/);
  expect(Number.parseFloat(motion.localDistance)).toBe(0.5);
  expect(Number.parseFloat(motion.worldDistance)).toBe(1.25);
});

test("reduced motion removes spatial, ceremonial and ambient movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await mountMotionSpecimens(page);

  const reduced = await page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-motion]")].map((element) => {
      const style = getComputedStyle(element);
      return {
        name: element.dataset.motion,
        animationName: style.animationName,
        transitionDuration: style.transitionDuration,
        transform: style.transform,
        opacity: style.opacity,
      };
    });
  });

  for (const specimen of reduced) {
    expect(specimen.animationName).toBe("none");
    expect(specimen.transform).toBe("none");
    expect(specimen.opacity).toBe("1");
  }
  const reducedControlDuration = reduced.find(
    (specimen) => specimen.name === "control",
  )?.transitionDuration;
  expect(reducedControlDuration).toBeDefined();
  expect(Number.parseFloat(reducedControlDuration!)).toBeLessThanOrEqual(0.000001);
});
