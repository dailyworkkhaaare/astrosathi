import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  installSupabaseMock,
  type TestLocale,
  type TestTheme,
} from "./support/mock-supabase";

const deviceCases: {
  name: string;
  viewport: { width: number; height: number };
  locale: TestLocale;
  theme: TestTheme;
  path: string;
}[] = [
  {
    name: "iPhone SE class",
    viewport: { width: 360, height: 780 },
    locale: "en",
    theme: "light",
    path: "/today",
  },
  {
    name: "iPhone 15 class",
    viewport: { width: 390, height: 844 },
    locale: "hi",
    theme: "dark",
    path: "/chat",
  },
  {
    name: "Pixel large class",
    viewport: { width: 430, height: 932 },
    locale: "mr",
    theme: "light",
    path: "/people",
  },
];

for (const device of deviceCases) {
  test(`store screenshot gate: ${device.name}`, async ({ context, page }) => {
    await page.setViewportSize(device.viewport);
    await page.emulateMedia({ colorScheme: device.theme, reducedMotion: "reduce" });
    await installAuthenticatedSession(context, {
      locale: device.locale,
      theme: device.theme,
    });
    await installSupabaseMock(page);

    await page.goto(device.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", device.locale);
    if (device.theme === "dark") {
      await expect(page.locator("html")).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
    }

    const geometry = await page.evaluate(() => {
      const fixedNav = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(
        (candidate) => {
          const rect = candidate.getBoundingClientRect();
          return getComputedStyle(candidate).position === "fixed" && rect.width > 0;
        },
      );
      const navRect = fixedNav?.getBoundingClientRect();
      const overflowing = [...document.body.querySelectorAll("*")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) return false;
          if (rect.bottom < 0 || rect.top > innerHeight) return false;
          const isMeaningful =
            element.matches(
              'button, a[href], input, select, textarea, img, svg, canvas, [role="button"], [role="link"]',
            ) || !!element.textContent?.replace(/\s+/g, " ").trim();
          if (!isMeaningful) return false;
          return rect.left < -1 || rect.right > innerWidth + 1;
        })
        .slice(0, 5)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        });

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        navBottom: navRect ? Math.round(navRect.bottom) : null,
        navWidth: navRect ? Math.round(navRect.width) : null,
        overflowing,
      };
    });

    expect(geometry.documentWidth, `${device.name} document width`).toBeLessThanOrEqual(
      geometry.viewportWidth + 1,
    );
    expect(geometry.overflowing, `${device.name} overflowing elements`).toEqual([]);
    expect(geometry.navBottom, `${device.name} bottom nav is visible`).toBeLessThanOrEqual(
      device.viewport.height + 1,
    );
    expect(geometry.navWidth, `${device.name} bottom nav spans viewport`).toBe(
      device.viewport.width,
    );
  });
}

test("offline mode shows a native-style network banner without replacing the screen", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedSession(context, { locale: "en", theme: "light" });
  await installSupabaseMock(page);

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "You're offline" })).toContainText(
    "You're offline",
  );
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Connection restored" })).toContainText(
    "Connection restored",
  );
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
});

test("install metadata and app icons are ready for native wrapping", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "AstroSaathi",
    short_name: "AstroSaathi",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151732",
    theme_color: "#151732",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/pwa-192x192.png", sizes: "192x192", purpose: "maskable" }),
      expect.objectContaining({ src: "/pwa-512x512.png", sizes: "512x512", purpose: "maskable" }),
    ]),
  );

  await page.goto("/");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png/,
  );

  const icons = await page.evaluate(async () => {
    const load = (src: string) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error(`Could not load ${src}`));
        image.src = src;
      });
    return {
      apple: await load("/apple-touch-icon.png"),
      pwa192: await load("/pwa-192x192.png"),
      pwa512: await load("/pwa-512x512.png"),
    };
  });

  expect(icons).toEqual({
    apple: { width: 180, height: 180 },
    pwa192: { width: 192, height: 192 },
    pwa512: { width: 512, height: 512 },
  });
});
